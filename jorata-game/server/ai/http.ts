import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  aborted?: boolean;
  on?: (event: string, callback: () => void) => unknown;
  off?: (event: string, callback: () => void) => unknown;
};
export type ApiResponse = {
  setHeader: (name: string, value: string) => unknown;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => unknown;
  end?: () => unknown;
};
export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new ApiFailure(status, code, message);
}
export function headers(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'",
  );
  const origin = req.headers.origin;
  const allowed = new Set(
    (process.env.APP_ORIGINS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
  for (const host of [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ])
    if (host) allowed.add(`https://${host}`);
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
    for (const host of ["localhost", "127.0.0.1"])
      allowed.add(`http://${host}:${process.env.PORT || 3000}`);
    if (process.env.CODESPACE_NAME)
      allowed.add(
        `https://${process.env.CODESPACE_NAME}-${process.env.PORT || 3000}.app.github.dev`,
      );
  }
  if (origin) {
    if (typeof origin !== "string" || !allowed.has(origin))
      fail(403, "ORIGIN_DENIED", "This application origin is not allowed.");
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
  }
  if (req.method === "OPTIONS") {
    res.status(204).end?.();
    return false;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    fail(405, "METHOD_NOT_ALLOWED", "Use POST.");
  }
  if (
    !/^application\/json(?:\s*;.*)?$/i.test(
      String(req.headers["content-type"] || ""),
    )
  )
    fail(415, "CONTENT_TYPE", "Use application/json.");
  if (Number(req.headers["content-length"]) > 16000)
    fail(413, "BODY_TOO_LARGE", "Request exceeds 16 KB.");
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  )
    fail(400, "INVALID_BODY", "Use a JSON object smaller than 16 KB.");
  if (Buffer.byteLength(JSON.stringify(req.body)) > 16000)
    fail(413, "BODY_TOO_LARGE", "Request exceeds 16 KB.");
  return true;
}
export async function authenticate(
  req: ApiRequest,
): Promise<{ client: SupabaseClient; userId: string }> {
  const auth = req.headers.authorization;
  if (
    typeof auth !== "string" ||
    !/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(auth)
  )
    fail(
      401,
      "AUTH_REQUIRED",
      "A verified account session is required. Guest sessions cannot use this API.",
    );
  const token = auth.slice(7),
    url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    fail(503, "AUTH_NOT_CONFIGURED", "Account services are not configured.");
  const secret = process.env.JORATA_AI_BACKEND_SECRET;
  const client = createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(secret ? { "x-jorata-backend": secret } : {}),
      },
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const identity = await client.auth.getUser(token);
  if (identity.error || !identity.data.user || identity.data.user.is_anonymous)
    fail(401, "INVALID_SESSION", "Please sign in with a verified account.");
  return { client, userId: identity.data.user.id };
}
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function rpcError(error: { code?: string; message: string }) {
  // Never send database diagnostics or provider errors (which can contain credentials) to clients.
  if (error.code === "42501")
    fail(403, "FORBIDDEN", "You are not permitted to perform this operation.");
  if (
    error.code === "JRA01" ||
    (error.code === "P0001" && /slow down|limit reached/i.test(error.message))
  )
    fail(429, "AI_LIMIT", "AI usage limit reached. Try again later.");
  if (error.code === "JRA02")
    fail(
      409,
      "AI_CONFLICT",
      "This request is running or its context changed. Refresh and try again.",
    );
  if (error.code === "JRA03")
    fail(
      400,
      "INVALID_OPERATION",
      "Check the request, group AI settings, selected messages and consent.",
    );
  if (error.code === "P0001")
    fail(
      400,
      "INVALID_OPERATION",
      "Check the requested values and current conversation permissions.",
    );
  fail(
    503,
    "DATA_UNAVAILABLE",
    "The operation could not be saved. Try again later.",
  );
}
export async function backend(
  client: SupabaseClient,
  operation: string,
  payload: Record<string, unknown>,
) {
  if (!process.env.JORATA_AI_BACKEND_SECRET)
    fail(503, "AI_NOT_CONFIGURED", "The AI backend is not activated.");
  const result = await client.rpc("jr_ai_backend", { operation, payload });
  if (result.error) rpcError(result.error);
  return result.data;
}
export function respondError(
  res: ApiResponse,
  error: unknown,
  requestId = randomUUID(),
) {
  if (error instanceof ApiFailure) {
    if (error.status === 429) res.setHeader("Retry-After", "60");
    res
      .status(error.status)
      .json({ error: error.message, code: error.code, request_id: requestId });
    return;
  }
  console.warn("JORATA API failed", {
    request_id: requestId,
    code: "INTERNAL",
  });
  res
    .status(503)
    .json({
      error: "The service is temporarily unavailable.",
      code: "SERVICE_UNAVAILABLE",
      request_id: requestId,
    });
}
