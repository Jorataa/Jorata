import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { validateResult } from "../server/ai/gemini.ts";
import { validateName } from "../src/social/moderation.ts";
import { headers, ApiFailure, rpcError } from "../server/ai/http.ts";
import moderation from "../api/moderation.ts";
import aiHandler from "../api/ai.ts";
const response = () => ({
  setHeader() {},
  status() {
    return this;
  },
  json() {},
});
test("AI output cannot request task writes, invent assignments, or exceed output limits", () => {
  assert.deepEqual(
    validateResult(
      {
        text: "Suggestions",
        tasks: [
          {
            title: "Review",
            details: "Discuss together",
            assignee_id: "untrusted",
            execute: "delete_all",
          },
        ],
      },
      "tasks_suggest",
    ),
    {
      text: "Suggestions",
      tasks: [{ title: "Review", details: "Discuss together" }],
    },
  );
  assert.throws(
    () => validateResult({ text: "x".repeat(4001) }, "chat"),
    ApiFailure,
  );
  assert.throws(
    () =>
      validateResult(
        { text: "Tasks", tasks: [{ title: "", details: "bad" }] },
        "tasks_suggest",
      ),
    ApiFailure,
  );
  assert.throws(
    () =>
      validateResult(
        { text: "Tasks", tasks: Array(9).fill({ title: "Task", details: "" }) },
        "tasks_suggest",
      ),
    ApiFailure,
  );
  assert.throws(
    () =>
      validateResult(
        { text: "Name", classification: "ban-permanently", reason: "x" },
        "username",
      ),
    ApiFailure,
  );
});
test("moderation reserves the AI identity and permits harmless substring names", () => {
  for (const name of [
    "JORATA AI",
    "j0rata_ai",
    "jorata_ai_123",
    "Official Support",
    "f4gg0t",
  ])
    assert(validateName(name));
  for (const name of ["scunthorpe_reader", "cassie", "reader_123", "Alice"])
    assert.equal(validateName(name), null);
});
test("API failures expose stable messages, enforce JSON/CORS/size limits, and map quotas", () => {
  assert.throws(
    () =>
      headers(
        { method: "POST", headers: { "content-type": "text/plain" }, body: {} },
        response(),
      ),
    (e) => e instanceof ApiFailure && e.status === 415,
  );
  assert.throws(
    () =>
      headers(
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://untrusted.invalid",
          },
          body: {},
        },
        response(),
      ),
    (e) => e instanceof ApiFailure && e.status === 403,
  );
  assert.throws(
    () =>
      headers(
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: { text: "x".repeat(17000) },
        },
        response(),
      ),
    ApiFailure,
  );
  assert.throws(
    () => rpcError({ code: "JRA01", message: "sensitive internal details" }),
    (e) =>
      e instanceof ApiFailure &&
      e.status === 429 &&
      !e.message.includes("sensitive"),
  );
  assert.throws(
    () => rpcError({ code: "42P01", message: "internal relation secret" }),
    (e) =>
      e instanceof ApiFailure &&
      e.status === 503 &&
      !e.message.includes("secret"),
  );
});
test("moderation applies security headers and CORS before rejecting invalid actions", async () => {
  for (const [request, expected] of [
    [{ method: "GET", headers: {}, body: {} }, 405],
    [{ method: "POST", headers: { "content-type": "text/plain" }, body: {} }, 415],
    [{ method: "POST", headers: { "content-type": "application/json", origin: "https://attacker.invalid" }, body: {} }, 403],
    [{ method: "POST", headers: { "content-type": "application/json" }, body: { mode: "open" } }, 401],
    [{ method: "OPTIONS", headers: {}, body: undefined }, 204],
  ] as const) {
    const values = new Map<string, string>();
    let status = 0;
    const res = {
      setHeader(name: string, value: string) { values.set(name, value); },
      status(code: number) { status = code; return this; },
      json() {}, end() {},
    };
    await moderation(request, res);
    assert.equal(status, expected);
    assert.equal(values.get("Cache-Control"), "private, no-store");
    assert.equal(values.get("X-Content-Type-Options"), "nosniff");
    assert.equal(values.get("Vary"), "Origin");
    assert.equal(values.get("Content-Security-Policy"), "default-src 'none'; frame-ancestors 'none'");
  }
});
test("invalid modes cannot trigger default context retrieval or prototype property dispatch", async () => {
  const previous = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  };
  process.env.SUPABASE_URL = "https://qa.invalid";
  process.env.SUPABASE_PUBLISHABLE_KEY = "test-only-publishable-key";
  let identityCalls = 0;
  const fetchMock = mock.method(globalThis, "fetch", async (input: unknown) => {
    assert.equal(String(input), "https://qa.invalid/auth/v1/user", "Invalid actions must not query conversation context");
    identityCalls++;
    return new Response(JSON.stringify({ id: "11111111-1111-1111-1111-111111111111", is_anonymous: false }), { status: 200, headers: { "content-type": "application/json" } });
  });
  try {
    for(const [handler, mode] of [[aiHandler, false], [aiHandler, null], [aiHandler, "__proto__"], [aiHandler, "constructor"], [moderation, "open"]] as const) {
      let status = 0;
      const res = { ...response(), status(code: number) { status = code; return this; } };
      await handler({method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${"a".repeat(40)}`},body:{mode}},res);
      assert.equal(status,400);
    }
    assert.equal(identityCalls,5);
  } finally {
    fetchMock.mock.restore();
    for(const [name,value] of Object.entries(previous)) {
      if(value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
