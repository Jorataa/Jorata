# Production operations

Vercel project: existing `j-mind` / `prj_gcx2ocyInULrQpyomxtQ7rzcqamh`, team `jovan-tioria-s-projects`; primary JORATA domain `jorata.vercel.app`. Project root must be **jorata-game**, framework Vite, build `npm run build`, output `dist`, install `npm ci`, Node 24. `vercel.json` serves SPA routes and the independent `/api/ai` function. No Socket.IO process is required on Vercel.

Supabase project: existing Jorata / `jedllbtlawxhimxugtcd`, restored and migrated additively. `supabase/migrations/` contains the applied schema and fixes. Do not drop the `jr_*` tables or reset the project: that deletes communication data. Legacy JSON world saves remain separate and untouched.

Required Vercel config (production, preview, local development):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — deliberately public; only the publishable key belongs in the browser.
- Optional server-only `GEMINI_API_KEY` and `GEMINI_MODEL` (default `gemini-flash-latest`). Never prefix the Gemini key with `VITE_`.

Use `.env.local` for local config; it is ignored. Never copy service-role keys into this app. RLS enforces private access with the signed-in user's JWT, including inside the AI API.

Auth: email/password registration is enabled and email confirmation is required. Set Auth Site URL to `https://jorata.vercel.app` and allow that origin and intended local/preview callback URLs in Supabase Auth URL Configuration. Configure production SMTP and verify real email delivery before inviting a large audience; Supabase's built-in mail service has recipient/throughput restrictions. Password recovery uses `/?recover=1`. Reserved example-domain email signups are rejected by the provider; they cannot prove email delivery. Enable leaked-password protection if available on the project's plan.

Private media buckets `jr-media` (5 MB) and `jr-avatars` (2 MB) accept JPEG, PNG and WebP. Signed image links expire after 60 seconds. Existing downloaded media cannot be recalled. Reports persist in `jr_reports`; review them in the Supabase dashboard until a moderator console is added.

## Verification

`npm test` runs local game and deterministic moderation checks. `npm run test:social` runs three real-account API/RLS checks; `npm run test:social:browser` runs Chromium user journeys against `TEST_URL` (default local port 3000). Run these two suites sequentially because they share QA accounts. Browser setup: `npx playwright install --with-deps chromium`.

Real-account suites read an untracked JSON file from `QA_ACCOUNTS_FILE` (default `/tmp/jorata-qa-bootstrap.json`) with `accounts: [{id,email,username,password,display_name}, ...]`. Provision three dedicated confirmed test accounts through Supabase's authorized admin interface; keep their credentials out of Git and logs. API verification writes non-secret test room IDs to `/tmp/jorata-qa-fixtures.json` for the browser suite. The temporary QA provisioning function used during development has been disabled and requires JWT verification; it returns 410 and contains no credentials.

Camera verification in automation uses Chromium's synthetic test device; physical iOS/Android camera behavior and email inbox delivery need actual device/inbox checks. Missing Gemini configuration returns an explicit 503, never fabricated content. The existing production secret was verified in the release below.

Known MVP limits: profile directory preloads 500 accounts and uses server search for more; message history loads 100 at a time; public communities require joining to access channels; each conversation owns one shared task list; presence is advisory; the managed Meadow validates update shape but trusts client movement. Polling catches missed updates every 12 seconds in addition to realtime and focus/reconnect refreshes. Add staging isolation, abuse controls/CAPTCHA and moderation operations before scaling public signup traffic.


## Verified release — 2026-10-17

Production `https://jorata.vercel.app` serves commit `de2fe78407cb4711ef70936782c535af7361e0c3` from `codex/jorata-social-v2` (deployment `dpl_5FN1y8eh3cDieGPT7gdxrx1VqEuq`). The real-account browser suite passed on this URL: independent login/session/logout, username search, DM history/reply/edit/reactions, group creation/invitation, shared tasks, camera capture/filters/private photos, profile photo upload, network recovery, mobile layout and two connected Meadow players. The existing Vercel Gemini secret was reused without reading/exporting it; the production summary API returned **200 with an actual provider summary** after explicit consent. Earlier provider failures were handled explicitly.

Three dedicated QA accounts verified RLS isolation, sender/edit/delete permissions, community roles, blocked DMs and private image access against the production Supabase project. Test accounts were confirmed through the authorized admin API; actual email inbox confirmation/password recovery delivery remains unverified because controlled test inboxes were not supplied. Physical phone camera behavior remains a manual device check. Public QA communities were removed only after checking that no non-QA members or messages belonged to them. Managed-world persistence and Unicode staff-name rejection also passed against the production database. Local Antigravity changes and unrelated repository deletions were left untouched.
