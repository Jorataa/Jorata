# JORATA — guest-first handoff

**Entry:** `src/main.tsx` → `src/guest/GuestApp.tsx` → shared `Workspace` in `src/social/SocialApp.tsx`. Opens directly, no authentication UI. Existing account logic remains behind an explicit opt-in `/accounts` route.

**Journeys:** choose temporary name → lounge or find guest → direct chat; create group → invite exact guest username → messages/photos/tasks; discover/join community → channels; optional Meadow → move/wave/chat/open nearby DM.

**Safe presentation files:** `src/social/social.css`; markup in shared Workspace, `TaskBoard`, `PhotoEditor`, `PrivateImage`; guest identity dialog and `GuestWorld` overlays. Preserve accessible labels and `data-room-id`, `data-message-id`, `data-task-id`, `#social-composer` test hooks. Scope styles to `.social-*` / `.guest-*`. Existing `src/App.tsx`, `src/styles.css` and original design components remain preserved; concurrent Antigravity edits were not overwritten.

**Functional contracts:** `src/social/types.ts` defines rows. Workspace accepts `platform` (the existing `useSocial` shape) and optional guest controls/media/world/notice. `src/guest/transport.ts` isolates identity/storage/realtime; `shared/guest-state.ts` enforces local action permissions; `server/guest-server.ts` binds server-issued capabilities. Do not put data mutations into visual components. Guest IDs are unverified, not production Auth identities.

**Boundaries:** local dev persists separate JSON, uses real Socket.IO. Vercel uses browser-only IndexedDB/BroadcastChannel sample data. Preserve the visible mode notice. Never enable guest endpoints in production or replace Supabase RLS with guest IDs. Future Supabase integration can reuse `useAccount`, `useSocial`, `client`, `media`, private Storage and existing `jr_action` migrations without rewriting this workspace.

**Photo/world:** camera starts only on explicit action and stops on capture/close; no upload before Send. Guest image rendering uses MediaResolver, secure account media uses signed URLs. `GuestWorld` shares the existing renderer/physics and transport signals; server checks coordinate shape but movement is client-trusted.

**Run:** `cd jorata-game && npm ci && npm run dev`; private Codespaces port 3000. `npm run build`, `npm test`, `GUEST_TEST_URL=http://localhost:3000 npm run test:guest:browser`. Use separate worktrees for simultaneous edits.
