import test from "node:test";
import assert from "node:assert/strict";
import { validateResult } from "../server/ai/gemini.ts";
import { validateName } from "../src/social/moderation.ts";
import { headers, ApiFailure, rpcError } from "../server/ai/http.ts";
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
