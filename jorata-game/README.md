# JORATA 2.0

A communication-first social platform with real Supabase accounts, private direct/group messages, communities and channels, shared tasks, creative photo sharing and an optional multiplayer Meadow.

## Run

```sh
cd /workspaces/Jorata/jorata-game
npm ci
# Configure .env.local from .env.example (publishable Supabase settings only).
npm run dev
```

Open Codespaces port **3000**. The normal entry is the account-based messaging workspace. Production uses Vercel static hosting and API functions plus Supabase Auth/Postgres/Realtime/Storage; it does not depend on a Codespaces Socket.IO server.

## Implemented

- Email/password registration and confirmation, login/logout, refresh-persistent sessions, unique moderated usernames, profile/bio/avatar editing and user search.
- Persistent private direct messages and groups, replies, own-message edits/deletion, reactions, timestamps, online presence and private typing signals.
- Group creation/invitations/removal/rename/leave, public community discovery/joining, channels and owner/admin/member permissions.
- One collaborative task board per conversation with assignment, deadlines, editing, completion and permission-checked deletion.
- User-triggered camera capture or uploads, filters, frame backgrounds, captions/stickers and explicit sharing into private image buckets.
- Block direct messages and submit reports. All private data reads use RLS; all mutations use a checked database RPC with rate/size limits.
- Optional `/world` with managed realtime players and persistent tile edits. Client movement is advisory, while conversation access remains database-enforced.
- A consent-based server-side Gemini summary endpoint, capped at 2/minute and 20/day. It returns a real configuration/provider error when unavailable.

## Verify

```sh
npm run build
npm test
# Dedicated confirmed QA accounts required; run these sequentially:
npm run test:social
TEST_URL=https://jorata.vercel.app npm run test:social:browser
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel/Supabase configuration, email setup and real-account test credentials format. Tests use actual Auth accounts and database/network requests; camera automation uses a synthetic Chromium device. Test credentials, environment files, screenshots and saved legacy worlds are ignored by Git.

See [DESIGN_HANDOFF.md](DESIGN_HANDOFF.md) for Antigravity's production UI boundaries and stable data contracts.

## Preserved local game

The original server-authoritative Socket.IO game remains at `/world-local` in development. A/D or arrows move, W/Space jumps, 1–3 select materials, click builds, right click removes. Its atomic JSON save remains `data/meadow.json`, configurable with `WORLD_FILE`. It survives restarts; back it up before rebuilding the Codespace. The legacy design shell and its local task/navigation concepts remain separate from the production social data layer. Legacy browser testing is available through `npm run test:browser`.
