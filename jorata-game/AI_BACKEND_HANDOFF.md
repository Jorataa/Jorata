# JORATA AI backend — Antigravity integration

Engineering branch: `codex/jorata-secure-ai`, worktree `/workspaces/jorata-secure-ai`. No visual components or styles changed. Do not reset the main workspace. Coordinate a targeted merge of backend/contracts/network changes; preserve current design work.

## Contract

`POST /api/ai` takes `Authorization: Bearer <Supabase access_token>` and `Content-Type: application/json`. Guest IDs, publishable keys and usernames are not authentication. `shared/ai-contracts.ts` defines request/response types; `src/services/jorata-ai.ts` exports `createJorataAi(getAccessToken, {endpoint?})`. Inject the existing real account token provider. Do not invoke protected AI from guest mode or create a login screen for this integration.

- `{mode:'open'}` → `{room_id,bot}`. Reuses one `jr_rooms.kind='ai'` conversation per account; normal `jr_messages` history and RLS apply.
- `{mode:'chat',room_id,request_id,prompt,consent:true}` → `{text,request_id,room_id,message_id,cached,bot}`. Generate a UUID once per user submission and retain it for retries. A user question persists even if Gemini fails. Show errors/retry explicitly.
- Group admin: `{mode:'settings',room_id,enabled:true|false}`. Read `jr_room_ai_settings` and show the AI-enabled state to all members. Disabled by default.
- `{mode:'mention',room_id,request_id,prompt,consent:true,message_ids?,include_recent?,source_message_id?,invocation?}`. Accepts `@Jorata`, `/ai`, or `invocation:'action'` for an explicit Ask action. Normally send the user's mention through existing `jr_action('send_message')` first, then pass its ID as source_message_id. It must belong to that user, match the prompt and remain undeleted.
- Context assistance: modes `summarize`, `explain`, `draft`, `translate`, `tasks_suggest`. Provide selected message IDs; optional `include_recent:true` explicitly includes up to 20 recent text messages. Default is no automatic history for contextual actions. `include_tasks:true` is available for task suggestions. Every selected ID is checked against the room. No photos are sent to Gemini.
- Task suggestions return `{text,tasks:[{title,details}],request_id,...}`. They create nothing. Display a preview, then require an explicit user confirmation: `{mode:'tasks_confirm',request_id,confirmation:true,items:[{index,assignee_id?,due_date?}]}`. Only stored suggestion indexes are accepted; the requester must still be a member, and assignees must be members. Confirmation is atomic and idempotent.
- `POST /api/moderation` (or `/api/ai`) supports `{mode:'username',username}` for deterministic preflight; add `analyze:true,consent:true,request_id` for optional Gemini classification. Returns allowed/review/disallowed with a short reason. AI recommendations do not permanently ban or reserve names. Actual signup/profile changes are checked again in Postgres.
- Reports: `{mode:'report',user_id,message_id?,reason}` → `{submitted:true,review:'human',ai_reviewed:false}`. Reports are not silently sent to Gemini. Review through the trusted Supabase dashboard; do not expose admin credentials in a UI.

## Rendering/privacy rules

AI messages have `sender_id:null`, `bot_id:'jorata-ai'`, and `ai_requested_by:<real user id>`. Render a clear JORATA AI / Google Gemini identity; never attribute these rows to the requesting user. Existing user messages keep their sender_id. Read bot metadata from `jr_bots`. Bot messages persist and synchronize via the existing messages table.

Render AI text as untrusted text/escaped Markdown, never raw HTML. `shared/link-safety.ts` rejects unsafe URL schemes and credentials in URLs; external links need confirmation and `noopener noreferrer`. Drafts must not be sent as users automatically.

Before sending private context, disclose Google Gemini processing and get an explicit action/consent. Show the selected scope. AI cannot fetch another room or run database tools. Changes/deletions/revocation during generation invalidate the answer before publication. Already-shared AI replies and downloaded media cannot be retroactively recalled.

`useSocial.ts` keeps its existing return shape; verified activity now uses `jr_touch`/`jr_activity`, not client-chosen typing/presence IDs. Old broadcast activity is unverified and should not be reused. Meadow position broadcasts remain advisory and are not account authorization.

## Runtime

Server only: GEMINI_API_KEY, JORATA_AI_BACKEND_SECRET; optional GEMINI_MODEL, GEMINI_MODERATION_MODEL, APP_ORIGINS. Supabase URL/publishable key may use existing VITE_SUPABASE_* settings; no service-role key is needed. Configure secrets in Vercel, never VITE_* or Git. The narrow backend secret's SHA-256 digest is registered in private.jr_backend_keys; protect/rotate it with deployment configuration. API allows only configured browser origins; same-origin deployment URLs are automatic.

AI is optional: normal chat continues during provider errors. Error responses are `{error,code,request_id}` with 400/401/403/409/413/415/429/502/503/504. Default budgets: 6 requests/user/minute, 40/user/UTC day, 200/site/UTC day, one active request/user and six/site. Failed calls count. Context is bounded; no sensitive shared prompt cache. Generation is JSON, not streamed; browser cancellation is best effort and provider billing may still occur.

Run `npm ci`, `npm run build`, `npm test`. `npm run test:ai:security` needs dedicated QA accounts, `.env.local` and ignored `.env.ai`; it injects a test-only provider. `AI_TEST_URL=<engineering-preview> npm run test:ai:live` verifies actual Gemini separately. Never use real private conversations as test fixtures.
