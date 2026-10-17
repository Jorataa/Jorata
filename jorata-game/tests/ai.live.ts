import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const base = process.env.AI_TEST_URL;
if (!base) throw new Error("Set AI_TEST_URL to the engineering deployment.");
const credentials = JSON.parse(
  await readFile(
    process.env.QA_ACCOUNTS_FILE || "/tmp/jorata-qa-bootstrap.json",
    "utf8",
  ),
).accounts;
const clients = credentials
  .slice(0, 3)
  .map(() =>
    createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  );
const tokens: string[] = [],
  ids: string[] = [];
for (let i = 0; i < 3; i++) {
  const r = await clients[i].auth.signInWithPassword({
    email: credentials[i].email,
    password: credentials[i].password,
  });
  assert.ifError(r.error);
  tokens.push(r.data.session!.access_token);
  ids.push(r.data.user!.id);
}
async function api(who: number, body: unknown) {
  const response = await fetch(`${base}/api/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokens[who]}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    200,
    JSON.stringify({
      status: response.status,
      code: data.code,
      error: data.error,
    }),
  );
  return data;
}
async function action(
  who: number,
  name: string,
  payload: Record<string, unknown> = {},
) {
  const r = await clients[who].rpc("jr_action", { action: name, payload });
  assert.ifError(r.error);
  return r.data;
}
try {
  const room = await api(0, { mode: "open" });
  const answer = await api(0, {
    mode: "chat",
    room_id: room.room_id,
    request_id: crypto.randomUUID(),
    prompt:
      "Introduce yourself as JORATA AI in one friendly sentence. Then suggest one simple way to plan a school project.",
    consent: true,
  });
  assert(answer.text.length > 10);
  assert.equal(answer.bot.id, "jorata-ai");
  const stored = await clients[0]
    .from("jr_messages")
    .select("*")
    .eq("id", answer.message_id)
    .single();
  assert.ifError(stored.error);
  assert.equal(stored.data.bot_id, "jorata-ai");
  assert.equal(stored.data.ai_requested_by, ids[0]);
  assert.equal(stored.data.sender_id, null);
  const next = await api(0, {
    mode: "chat",
    room_id: room.room_id,
    request_id: crypto.randomUUID(),
    prompt:
      "What kind of project did I just ask about? Answer briefly using this conversation.",
    consent: true,
  });
  assert(/school|project/i.test(next.text));
  const stranger = await clients[1]
    .from("jr_messages")
    .select("*")
    .eq("room_id", room.room_id);
  assert.deepEqual(stranger.data, []);
  const group = (
    await action(0, "create_group", { name: `Gemini live ${Date.now()}` })
  ).id;
  await action(0, "add_member", { room_id: group, user_id: ids[1] });
  const plan = (
    await action(0, "send_message", {
      room_id: group,
      body: "Our school project needs three steps: research the topic, prepare slides, and rehearse a presentation next Friday.",
    })
  ).id;
  await api(0, { mode: "settings", room_id: group, enabled: true });
  const prompt = "@Jorata summarize our plan in two sentences.";
  const invocation = (
    await action(1, "send_message", { room_id: group, body: prompt })
  ).id;
  const mention = await api(1, {
    mode: "mention",
    room_id: group,
    request_id: crypto.randomUUID(),
    prompt,
    source_message_id: invocation,
    message_ids: [plan],
    consent: true,
  });
  assert(mention.text.length > 10);
  const groupBot = await clients[0]
    .from("jr_messages")
    .select("bot_id,ai_requested_by")
    .eq("id", mention.message_id)
    .single();
  assert.equal(groupBot.data!.bot_id, "jorata-ai");
  assert.equal(groupBot.data!.ai_requested_by, ids[1]);
  const before = (
    await clients[0].from("jr_tasks").select("id").eq("room_id", group)
  ).data!.length;
  const suggestions = await api(0, {
    mode: "tasks_suggest",
    room_id: group,
    request_id: crypto.randomUUID(),
    message_ids: [plan],
    prompt: "Propose our three project tasks.",
    consent: true,
  });
  assert(
    Array.isArray(suggestions.tasks) &&
      suggestions.tasks.length > 0 &&
      suggestions.tasks.length <= 8,
  );
  assert.equal(
    (await clients[0].from("jr_tasks").select("id").eq("room_id", group)).data!
      .length,
    before,
  );
  const confirmed = await api(0, {
    mode: "tasks_confirm",
    request_id: suggestions.request_id,
    confirmation: true,
    items: [{ index: 0, assignee_id: ids[1], due_date: "2026-12-01" }],
  });
  assert.equal(confirmed.task_ids.length, 1);
  const moderation = await api(2, {
    mode: "username",
    request_id: crypto.randomUUID(),
    username: "riverwalker_7",
    analyze: true,
    consent: true,
  });
  assert(
    ["allowed", "review", "disallowed"].includes(moderation.classification),
  );
  const usage = await clients[0]
    .from("jr_ai_requests")
    .select("model,status,input_tokens,output_tokens")
    .eq("id", answer.request_id)
    .single();
  assert.ifError(usage.error);
  assert.equal(usage.data.status, "done");
  assert.notEqual(usage.data.model, "test-only-stub");
  assert(usage.data.output_tokens > 0);
  const newClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${tokens[0]}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  assert.equal(
    (
      await newClient
        .from("jr_messages")
        .select("*")
        .eq("id", answer.message_id)
        .single()
    ).data!.body,
    stored.data.body,
  );
  const report = {
    url: base,
    passed: [
      "real Gemini direct chat",
      "persistent explicit AI actor and requester attribution",
      "recent conversation context",
      "cross-user AI room isolation",
      "real group @Jorata answer",
      "group opt-in",
      "structured task proposals without writes",
      "explicit authorized task creation",
      "real Gemini username classification",
      "token usage accounting",
      "history re-read by a fresh client",
    ],
    model: usage.data.model,
    classification: moderation.classification,
    sampleAnswer: answer.text,
    group_id: group,
    ai_room_id: room.room_id,
  };
  await writeFile(
    "/tmp/jorata-ai-live-result.json",
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report));
} finally {
  for (const client of clients) await client.auth.signOut();
}
