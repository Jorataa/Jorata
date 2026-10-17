# JORATA 2.0 — production handoff

The production entry is `src/social/SocialApp.tsx`. The earlier design shell in `src/App.tsx` is preserved for the local Socket.IO world at `/world-local`; its local task store and illustrative channel navigation are not the production data layer.

**Journeys:** create account → confirm email → sign in → find username → direct chat; create group → invite by username → message/share photos/manage tasks; discover/join community → open channels. Profile editing, block/report, leave/remove membership and an optional managed Meadow are available from the workspace.

**Safe styling/components:** `src/social/social.css`, presentation in `AuthPanel`, `SocialApp`, `TaskBoard`, `PhotoEditor`, `PrivateImage`, `SocialWorld`. Keep accessible labels and `data-room-id`, `data-message-id`, `data-task-id`, `#social-composer` hooks, or update browser tests alongside markup changes. Scope styles to `.social-*` to preserve the game UI.

**Logic boundary:** `useAccount.ts` owns Auth/session/profile; `useSocial.ts` owns database snapshots, subscriptions, reconnect catch-up, presence/typing; `client.ts` owns the Supabase client and `action(name,payload)` RPC; `types.ts` is the UI data contract. All mutations call `jr_action` and all private reads use RLS. The database, not UI visibility, enforces sender identity, membership, ownership and rate limits.

**Media/AI:** `media.ts` validates/re-encodes uploads; use private Storage signed URLs, never public URLs. Camera must start on explicit action and stop on capture/close. `api/ai.ts` requires a valid bearer session, conversation membership and explicit consent; Gemini remains disabled without its server-side key.

**World:** `shared/game.ts`/`src/game/` retain engine contracts. `SocialWorld` uses managed Supabase channels and persistent tile edits; the earlier authoritative Socket.IO server remains local-only. The managed scene trusts client movement and is a social gathering space.

**Run:** `cd jorata-game && npm ci && npm run dev`, Codespaces port 3000. `npm run build`, `npm test`; see `DEPLOYMENT.md` for real-account test setup. Use separate worktrees for concurrent UI work.
