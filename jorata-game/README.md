# JORATA — Play. Create. Remember.

A personal Canvas sandbox and Markdown notebook. Guest-first, without accounts or chat.

## Run

Node 24 recommended.

```sh
npm ci
npm run dev
```

Open http://localhost:3107. No environment variables, database, or API keys are required.

```sh
npm test
npm run build
npm run test:browser
```

Install Playwright Chromium if absent (`npx playwright install chromium`). Browser suites run against `http://localhost:3107`; start the dev server first. See `tests/` for environment overrides for hosted runs.

## Product

- `/`: Mosslight entrance and actual recently edited notes.
- `/play`: single-player 100 × 32 tile world; gravity, collision, jumping, collect/build, earth/stone/wood inventory, chapter goals, keyboard and touch controls, particles and parallax. Saves automatically and manually. JSON export/import validates snapshots before replacing a world.
- `/notes`: create/edit/delete, autosave, safe basic Markdown preview (headings/lists/quotes), folders, tags, search, pinning, recency/custom ordering, drag-to-file/reorder plus keyboard alternatives, individual Markdown export.
- `/settings`: motion, cursor companion, storage protection request, keyboard shortcuts.
- Quick note: `Ctrl/⌘ + J` from any screen, or `N` in Play. Draggable panel, focus containment, Escape to close. Gameplay pauses while writing.

## Persistence and limits

Notes use IndexedDB `jorata-notes-v1` with a synchronous localStorage recovery snapshot; world saves use IndexedDB `jorata-play` plus a synchronous localStorage recovery copy. Export regularly: browser-data clearing, private browsing, storage eviction, or a different browser/device can make local data unavailable. Storage failures are surfaced, with note export available. Notes support one active editing tab; concurrent independent edits in multiple tabs are not merged. There is no cloud or cross-device synchronization, multiplayer, authentication, or hosted game server.

## Architecture

React + TypeScript + Vite; runtime dependencies are React and React DOM only. Play and Notes load as separate chunks. Canvas animation uses bounded delta time, capped device pixel ratio, and visible-tile rendering. Motion respects device reduced-motion and user settings. Fonts are locally served Manrope and Newsreader from Google Fonts (SIL Open Font License). All world artwork is original code-drawn geometry.

The old social frontend, chat components and state, Socket.IO services, AI chat API, shared social schemas, old tests, and unused dependencies were removed. Obsolete routes are not deployed. Historical database migrations/functions are preserved in the pre-rebuild archive, not deployed by this product. Remote legacy data is retained because the Supabase project also hosts an unrelated portal. See `rebuild-audit.md` before any future remote resource retirement.
