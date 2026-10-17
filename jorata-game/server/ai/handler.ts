import { randomUUID } from "node:crypto";
import type { AiMode, AiResponse } from "../../shared/ai-contracts.js";
import { JORATA_AI } from "../../shared/ai-contracts.js";
import { validateName } from "../../src/social/moderation.js";
import { generate } from "./gemini.js";
import {
  ApiFailure,
  authenticate,
  backend,
  fail,
  headers,
  respondError,
  uuid,
  type ApiRequest,
  type ApiResponse,
} from "./http.js";
const modes: AiMode[] = [
  "chat",
  "mention",
  "summarize",
  "explain",
  "draft",
  "translate",
  "tasks_suggest",
  "username",
];
const knownFields = new Set([
  "mode",
  "request_id",
  "room_id",
  "prompt",
  "message_ids",
  "consent",
  "include_recent",
  "include_tasks",
  "source_message_id",
  "username",
  "invocation",
  "enabled",
  "confirmation",
  "items",
  "user_id",
  "message_id",
  "reason",
  "analyze",
]);
const instructions: Record<AiMode, string> = {
  chat: "Answer the user directly.",
  mention: "Answer this explicit group invocation.",
  summarize:
    "Summarize the selected discussion. Highlight decisions, open questions and action items.",
  explain: "Explain the selected messages clearly.",
  draft:
    "Propose a reply for the requesting user. This is a draft only; do not send it.",
  translate: "Translate the selected messages as requested. Do not add facts.",
  tasks_suggest:
    "Suggest at most eight actionable tasks from the authorized context. Put only title and details in each task. Do not claim that any task has been created or assigned.",
  username:
    "Classify only the proposed username as allowed, review, or disallowed. Be conservative about ambiguous names. Do not infer personal characteristics.",
};
function validate(body: Record<string, unknown>) {
  if (Object.keys(body).some((k) => !knownFields.has(k)))
    fail(
      400,
      "UNKNOWN_FIELD",
      "Unknown request field. Client histories, sender identities and permissions are not accepted.",
    );
  if (body.room_id !== undefined && !uuid(body.room_id))
    fail(400, "INVALID_ROOM", "Use a valid conversation ID.");
  if (body.request_id !== undefined && !uuid(body.request_id))
    fail(400, "INVALID_REQUEST_ID", "Use a UUID request ID.");
  if (
    body.prompt !== undefined &&
    (typeof body.prompt !== "string" || body.prompt.length > 4000)
  )
    fail(400, "INVALID_PROMPT", "Use a prompt of at most 4000 characters.");
  if (
    body.message_ids !== undefined &&
    (!Array.isArray(body.message_ids) ||
      body.message_ids.length > 30 ||
      !body.message_ids.every(uuid) ||
      new Set(body.message_ids).size !== body.message_ids.length)
  )
    fail(400, "INVALID_SELECTION", "Select at most 30 distinct message IDs.");
  for (const key of ["include_recent", "include_tasks", "enabled", "analyze"])
    if (body[key] !== undefined && typeof body[key] !== "boolean")
      fail(400, "INVALID_OPTION", "Options must be boolean values.");
  if (body.source_message_id !== undefined && !uuid(body.source_message_id))
    fail(400, "INVALID_MESSAGE", "Use a valid invocation message ID.");
  if (
    body.invocation !== undefined &&
    !["mention", "command", "action"].includes(String(body.invocation))
  )
    fail(400, "INVALID_INVOCATION", "Choose an explicit AI invocation.");
}
/** Dependency injection is for isolated tests, never chosen by request data or production configuration. */
export function createAiHandler(provider: typeof generate = generate) {
  return async (req: ApiRequest, res: ApiResponse) => {
    const correlation = randomUUID();
    let client: Awaited<ReturnType<typeof authenticate>>["client"] | undefined,
      jobId: string | undefined;
    const cancelled = new AbortController(),
      onAbort = () => cancelled.abort();
    req.on?.("aborted", onAbort);
    try {
      if (!headers(req, res)) return;
      ({ client } = await authenticate(req));
      const body = { ...(req.body as Record<string, unknown>) };
      validate(body);
      const mode = body.mode || "summarize";
      const fields: Record<string, string[]> = {
        open: ["mode"],
        settings: ["mode", "room_id", "enabled"],
        tasks_confirm: ["mode", "request_id", "confirmation", "items"],
        report: ["mode", "user_id", "message_id", "reason"],
        username: ["mode", "request_id", "username", "analyze", "consent"],
      };
      const permitted = fields[String(mode)] || [
        "mode",
        "request_id",
        "room_id",
        "prompt",
        "message_ids",
        "consent",
        "include_recent",
        "include_tasks",
        "source_message_id",
        "invocation",
      ];
      if (Object.keys(body).some((key) => !permitted.includes(key)))
        fail(
          400,
          "INVALID_FIELD_FOR_ACTION",
          "This field is not accepted for the selected action.",
        );

      if (mode === "open") {
        res
          .status(200)
          .json({ ...(await backend(client, "open", {})), bot: JORATA_AI });
        return;
      }
      if (mode === "settings") {
        if (!uuid(body.room_id) || typeof body.enabled !== "boolean")
          fail(
            400,
            "INVALID_SETTINGS",
            "Choose a group and whether AI is enabled.",
          );
        res
          .status(200)
          .json(
            await backend(client, "settings", {
              room_id: body.room_id,
              enabled: body.enabled,
            }),
          );
        return;
      }
      if (mode === "report") {
        if (
          !uuid(body.user_id) ||
          (body.message_id !== undefined && !uuid(body.message_id)) ||
          typeof body.reason !== "string" ||
          body.reason.trim().length < 3 ||
          body.reason.length > 1000
        )
          fail(
            400,
            "INVALID_REPORT",
            "Choose a report target and a reason of 3–1000 characters.",
          );
        res
          .status(200)
          .json(
            await backend(client, "report", {
              user_id: body.user_id,
              message_id: body.message_id,
              reason: body.reason.trim(),
            }),
          );
        return;
      }
      if (mode === "tasks_confirm") {
        if (
          !uuid(body.request_id) ||
          body.confirmation !== true ||
          !Array.isArray(body.items) ||
          body.items.length < 1 ||
          body.items.length > 8
        )
          fail(
            400,
            "CONFIRMATION_REQUIRED",
            "Select tasks and explicitly confirm their creation.",
          );
        for (const item of body.items) {
          if (
            !item ||
            typeof item !== "object" ||
            !Number.isInteger(item.index) ||
            item.index < 0 ||
            item.index > 7 ||
            Object.keys(item).some(
              (k) => !["index", "assignee_id", "due_date"].includes(k),
            ) ||
            (item.assignee_id !== undefined && !uuid(item.assignee_id)) ||
            (item.due_date !== undefined &&
              (typeof item.due_date !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(item.due_date)))
          )
            fail(
              400,
              "INVALID_TASK_SELECTION",
              "Use stored task indexes, member IDs and valid dates.",
            );
        }
        res.status(200).json(await backend(client, "confirm_tasks", body));
        return;
      }
      if (!modes.includes(mode as AiMode))
        fail(400, "INVALID_MODE", "Choose a supported AI action.");
      const aiMode = mode as AiMode;
      if (aiMode === "username") {
        if (typeof body.username !== "string" || body.username.length > 60)
          fail(400, "INVALID_NAME", "Enter a proposed username.");
        await backend(client, "moderation_check", {});
        const name = body.username.normalize("NFKC").trim().toLowerCase(),
          error = validateName(name, true);
        if (error) {
          res
            .status(200)
            .json({
              classification: "disallowed",
              reason: error,
              source: "deterministic",
              appeal: "Choose a corrected name or request a human review.",
            });
          return;
        }
        if (body.analyze !== true) {
          res
            .status(200)
            .json({
              classification: "allowed",
              reason: "Basic checks passed. This does not reserve the name.",
              source: "deterministic",
            });
          return;
        }
        body.username = name;
        if (
          body.room_id ||
          body.message_ids ||
          body.include_recent ||
          body.include_tasks ||
          body.prompt
        )
          fail(
            400,
            "INVALID_NAME_CONTEXT",
            "Username analysis cannot include conversation content.",
          );
      } else if (!uuid(body.room_id))
        fail(400, "ROOM_REQUIRED", "Choose an authorized conversation.");
      if (body.consent !== true)
        fail(
          400,
          "CONSENT_REQUIRED",
          "Confirm that the selected content may be sent to Google Gemini.",
        );
      if (!process.env.GEMINI_API_KEY)
        fail(
          503,
          "GEMINI_NOT_CONFIGURED",
          "Gemini is not activated. Configure its server-side secret.",
        );
      body.mode = aiMode;
      body.request_id = body.request_id || randomUUID();
      // Preserve the existing consent-based summary endpoint. New contextual actions default to selected messages only.
      if (req.body && !(req.body as Record<string, unknown>).mode)
        body.include_recent = true;
      if (aiMode === "chat" && body.include_recent === undefined)
        body.include_recent = true;
      const admitted = await backend(client, "begin", body);
      if (admitted.cached) {
        res
          .status(200)
          .json({
            ...admitted.result,
            text: admitted.result.text,
            request_id: body.request_id,
            room_id: admitted.room_id,
            message_id: admitted.message_id,
            cached: true,
            bot: JORATA_AI,
          });
        return;
      }
      jobId = String(body.request_id);
      const output = await provider({
        mode: aiMode,
        instruction: `${instructions[aiMode]}\nUser request: ${aiMode === "username" ? body.username : String(body.prompt || "")}`,
        context: admitted.context,
        signal: cancelled.signal,
      });
      if (cancelled.signal.aborted)
        fail(499, "CANCELLED", "The request was cancelled.");
      const saved = await backend(client, "finish", {
        request_id: jobId,
        result: output.result,
        model: output.model,
        input_tokens: output.inputTokens,
        output_tokens: output.outputTokens,
      });
      const response: AiResponse = {
        ...output.result,
        request_id: jobId,
        room_id: saved.room_id || undefined,
        message_id: saved.message_id || undefined,
        cached: false,
        bot: JORATA_AI,
      };
      res.status(200).json(response);
    } catch (e) {
      if (client && jobId) {
        try {
          await backend(client, "fail", {
            request_id: jobId,
            code: e instanceof ApiFailure ? e.code : "INTERNAL",
          });
        } catch {
          /* No sensitive diagnostics. An expired lease stops unfinished work from consuming concurrency forever. */
        }
      }
      console.warn("JORATA AI operation failed", {
        request_id: correlation,
        job_id: jobId,
        code: e instanceof ApiFailure ? e.code : "INTERNAL",
      });
      respondError(res, e, correlation);
    } finally {
      req.off?.("aborted", onAbort);
    }
  };
}
export default createAiHandler();
