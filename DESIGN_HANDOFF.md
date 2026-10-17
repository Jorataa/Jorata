# JORATA → Antigravity

**Working MVP:** one shared Meadow world, guest names/colored avatars, keyboard and touch movement, jumping/collisions, camera follow, live player presence, world chat, three unlimited building materials/removal, protected spawn, respawn/reconnect and persistent world edits. The current UI also includes local PNG snapshots, quick chat reactions, player passports, synthesized audio and canvas effects.

**Run:** `cd jorata-game && npm ci && npm run dev`, then open Codespaces port **3000**. Use two tabs with different names. `npm test` checks multiplayer/persistence; `npm run test:browser` checks Chromium flows (see game README for browser installation).

**Safe presentation files:** `jorata-game/src/styles.css`, `src/components/{JoinScreen,GameHUD,ChatPanel,BuildToolbar,ControlsHelpModal,PlayerProfileModal,SnapshotModal}.tsx` and layout/markup in `src/App.tsx`. Canvas colors and drawing live in `src/game/renderer.ts`; coordinate with engineering before modifying its input, camera or animation loop. No external artwork is required.

**Preserve functionality:** component props/callbacks; accessible names and labels; `game-canvas`, `chat-input`, and `username` IDs; toolbar selection and remove modes; chat focus/input isolation; touch pointer capture/release; disconnected state. `jorata-open-chat` opens/focuses chat (optional `{text}` detail populates mentions); `jorata-control` carries touch input. Q/X must update React toolbar state and the game model together. Dialogs block movement. Keep `.sr-only` for accessibility and hidden hooks; chat starts minimized on phones. Keep existing class hooks or update `tests/browser.ts` alongside structural changes. Test the two-player flow after a redesign.

**Engineering boundary:** `shared/game.ts` owns physics/protocol/material IDs; `server/` owns validation, simulation and atomic saves; `src/useGame.ts` owns networking; `src/game/model.ts` owns client state. Avoid edits here for visual changes. Player/build truth belongs to the server.

Use a separate branch/worktree for concurrent design work. Local saves under `jorata-game/data/` and test screenshots under `artifacts/` are ignored by Git. Snapshots download locally; there is no photo-upload service, account system or private messaging yet.
