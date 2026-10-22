# JORATA Play + Notes verification

Verified locally on 2026-10-22 against http://localhost:3107 with Chromium. Production release is pending; do not treat the existing public domain as this rebuild until a READY release is verified.

## Critical stories

| Step | User action | Result |
| --- | --- | --- |
| 1 | Home → Enter World; dock navigation | Passed at 1440, 768, and 390px with no horizontal page overflow or JavaScript errors |
| 2 | Move, jump, collect, build | Browser suite passed real keyboard/canvas interactions; inventory changes checked |
| 3 | Save world, refresh, resume | Browser suite passed restored tiles, inventory, player location; valid/invalid JSON backup import and export checked |
| 4 | Open quick note mid-jump | Browser suite confirmed frozen player while writing and resumed physics after closing |
| 5 | Create/edit a note, organize, refresh | Browser suite passed IndexedDB restore, title/body/folder/tag/pin persistence, search/tag filtering |
| 6 | Drag notes into folders and reorder | Browser suite passed actual drag and keyboard ordering controls |
| 7 | Export/delete a note | Markdown download and confirmed deletion after immediate refresh passed after adding synchronous recovery snapshot |
| 8 | Touch/mobile writing and gameplay | 390px layout and touch contexts passed; physical devices remain untested |
| 9 | Storage unavailable | Error is visible; writing remains exportable. Local recovery copy restores writing even when IndexedDB is blocked |
| 10 | Settings and obsolete entry points | Motion preference persists, reduced-motion animation disabled, old accounts path ends without chat UI |

Commands: `npm test` (3 model/physics tests), `npm run build` (TypeScript + Vite), `node --import tsx tests/product.browser.ts`, `node --import tsx tests/play.browser.ts`, `node --import tsx tests/notes.browser.ts`.

Play and Notes browser suites exercise UI → persistence → reload → restored UI, without a backend. No cloud synchronization or FPS benchmark is claimed. Browser automation is not a complete accessibility audit or a physical-device performance measurement.

## Source cleanup and preservation

Removed old social/guest frontend, conversation/composer components, chat state and navigation, Socket.IO backend, AI chat API, shared chat schemas, unused social dependencies and tests, and obsolete local Supabase deployment resources. Runtime dependencies are React and React DOM. The static app has no Supabase, Socket.IO, AI, messaging, account, or game-server endpoint.

Remote chat data was retained because the database also hosts unrelated portal resources and there is no tested full database + object backup. No database drop or remote data deletion was performed. See `rebuild-audit.md`.

Recoverable source checkpoints: `backup/pre-play-notes-20261022`, `../rebuild-backups/repository.bundle`, `../rebuild-backups/workspace.patch`, `../rebuild-backups/jorata-game-working-tree.tar.gz`. Private local environment and ignored data files remain untouched.

## Design QA

Direction: Achromatic ledger, seed 752260866, brand palette/type retained. The user's specified charcoal/sage/ivory palette, floating dock, and restrained glass effects override conflicting generic skill defaults. Idea: Mosslight's block landscape becomes the entrance to a world, beside a personal field notebook. No external visual reference or Figma file was supplied. Original world artwork is drawn in code; locally hosted open-source fonts include their licenses.

Screenshot evidence is in ignored `artifacts/rebuild/`; browser inspector reports/screenshots are in `/tmp/jorata-rebuild-qa/`. Screenshots were opened for desktop/tablet/mobile Home, Play, and Notes, plus populated Notes and quick note. Notes contrast and small labels were repaired; game viewport reduced to keep inventory clear of the floating dock. Inspector reported zero FAILs for Home, Play and Notes at the three widths. Warnings retained intentionally: editorial heading scale, requested warm ivory, and compact secondary metadata. These are not claims of full accessibility conformance.

ROUND 2
Seen in one second: a quiet block world with a clear Enter World action.
Idea (one sentence): Mosslight is a place to build, and the notebook holds what you discover.
Live thing: the entrance opens the playable saved world; recent notes come from the actual local library.
Layout words by section: home=editorial split / world=wide canvas-like scene / notes=writing desk / play=world and tools.
Scores: design 6.5 · usability 8 · creativity 7 · content 8 → overall 7.15.
Caps applied: the page rubric caps design at 6.5 without four photographs; photographs would not improve this original game/editor product.
Top three problems and fixes:
1. Tablet note heading wrapped to three lines (home tablet screenshot): shortened to “Keep a thought. For another day.”
2. Phone metadata was too small (Home/Play/Notes phone screenshots): raised secondary labels to at least 11px and key controls to 12–16px.
3. Dock overlapped game inventory at the initial viewport (Play fold screenshots): reduced game canvas height responsively and retained bottom scroll space.
Remaining limitations: basic Markdown preview; one active notes editing tab; browser-local saves; no multiplayer, cloud sync, or physical-device performance certification. Cursor companion retains the native pointer and is disabled for touch/reduced motion.

## Deployment status

Existing target: j-mind / prj_gcx2ocyInULrQpyomxtQ7rzcqamh, team jovan-tioria-s-projects. Existing live alias https://jorata.vercel.app.

The GitHub-triggered preview and connected Vercel create-deployment operation returned BLOCKED before build logs were available. GitHub status: “Deployment was blocked.” CLI inspection reported no local credentials. A Vercel device authorization was requested for the mapped CLI fallback. No failed preview was promoted; previous production remains in place. See DEPLOYMENT.md for rollback and release procedure.
