# JORATA recovery report — 2026-10-26

## Scope and branch decision

43 starting local/remote refs inspected, including main, play-notes, secure-ai, all accessible Codex/Claude/development/backup branches. Full branch names, SHAs, file trees and deltas: [JORATA_AUDIT.md](../JORATA_AUDIT.md) and [audit JSON](audit-20261026.json). Clean main was preserved before integration. Nested Boxing and Secure AI worktrees were inspected. Fetch used no pruning.

Foundation: play-notes `b75c59d`, with 884 compatible files selected from the newer complete recovery snapshot `64c8e01`. The local stash's game source is identical to that newer snapshot. Alternate Boxing UI remains recoverable on its independent backup. Messaging/security branches were inspected and preserved; their social UI/server/Supabase code was not merged into the gaming app. The root productivity app is historical preserved source; the current runnable gaming entrypoint is `jorata-game/`.

## Confirmed remote backups

| Backup | Commit | Preservation |
| --- | --- | --- |
| [workspace 20261026](https://github.com/Jorataa/Jorata/tree/backup/workspace-recovery-20261026) | [f1c31a0](https://github.com/Jorataa/Jorata/commit/f1c31a00c9899e178fb70cef5fc8ee93dd68976b) | Original main history + complete initial audit |
| [stash 20261026](https://github.com/Jorataa/Jorata/tree/backup/stash-recovery-20261026) | [5181ffb](https://github.com/Jorataa/Jorata/commit/5181ffb02c612f1ec8143bb18b676c6cb3b8f897) | 1,097 inspected stash source/assets + originals + separate CRC salvage |
| [workspace 20261025](https://github.com/Jorataa/Jorata/tree/backup/workspace-recovery-20261025) | [64c8e01](https://github.com/Jorataa/Jorata/commit/64c8e01709a695b0e8a47db60c093c1b148cb5c4) | Newer complete five-game source + original website ZIP locations |
| [Boxing 20261025](https://github.com/Jorataa/Jorata/tree/backup/boxing-workspace-20261025) | [12a7d1d](https://github.com/Jorataa/Jorata/commit/12a7d1d2f2874fc98e48a9d1e73303b009c7eb3b) | Independent Boxing source + original Boxing ZIP |

GitHub refs were checked with ls-remote. All 14 LFS objects were downloaded into a fresh store: 205,226,279 bytes, zero hash mismatches. No force-pushes, resets, branch deletions, production deployment or merge into main. The original local stash remains intact.

## Recovered files and assets

Full source/destination lists: [integration-files.json](integration-files.json), [runtime-assets.json](runtime-assets.json), [asset-inventory.json](asset-inventory.json), and [asset notes](ASSETS.md). 818 public runtime files are inventoried with hashes; PNG metadata includes dimensions and transparency. 123 premium ZIP members are inventoried, with 25 selected assets/docs extracted. Source archives stay in backups and outside deployed public folders.

Supplied emblem/favicon, separate desktop/phone city artwork, Surgery/Boxing/Rooftop covers are integrated into the website. Original Mosslight SVG, Drive cover, all character sprites, game scenery, surgical tools and videos are retained. A redundant deployed Boxing directory was omitted only after reference checks. Nine remaining identical-content groups are kept to preserve existing manifest contracts. No original source artwork was overwritten.

## Game and Notes status

| Feature | Current evidence |
| --- | --- |
| Mosslight | Browser movement, jumps, collect/build, save/reload, import/export, modified-key protection, quick-note pause/resume, mobile controls pass |
| Surgery | All 14 case wins, loss, drag/touch tool application, guide, progress, responsive views, real video playback, fixed bed across moods, corrupt/blocked storage pass |
| Boxing | Shared-keyboard controls, combos, simultaneous actions, custom bindings/anti-ghosting, solo AI and responsive layout pass on repeat |
| Rooftop | 9 model tests; 384 asset hashes/paths, 38 sprite layouts, 16 collider contracts; all 3 browser routes complete; focused phone controls/rotation pass. Full browser suite passes: all routes, pause/focus, touch, persistence, 20 retries, cleanup/re-entry, no browser errors/failed assets |
| Drive | Complete retry passes all six vehicles, three environments, five cameras, weather/time/quality, six simulated minutes of bounded chunk ownership, persistence, focus pause, cleanup and narrow layout |
| Notes | Create/edit/autosave/reload, folders/tags/pins, search, reorder/drag, Markdown export, deletion, touch editing, quick-note recovery, blocked IndexedDB recovery pass |

All 49 gameplay/Notes source files remain byte-identical to the recovery snapshot after the motion work. This recovery changes presentation, host deep-link configuration, docs and test infrastructure. Optional live Gemini/AI behavior is not claimed as verified; missing-configuration and spoiler boundaries pass unit tests.

## UI/UX and verification

Home, Games, Notes, Settings navigation; supplied brand identity; responsive city hero; large unlettered covers; calmer game launch actions; responsive gallery; searchable five-game library; separate local notebook. Added deep-link rewrites for Boxing, Rooftop, Drive. No gameplay rebuild.

- `npm ci`: 38 installed packages audited, zero reported vulnerabilities in the gaming app.
- `npm run build`: passes; TypeScript + Vite production bundle. Phaser/Three lazy chunks exceed 500 kB (expected warning, no hidden suppression).
- `npm test`: 23/23 pass. `npm run test:rooftop`: 9/9 pass + asset contracts.
- `TEST_BASE_URL=http://localhost:3117 npm run test:browser`: passes Product, Mosslight and Notes.
- `npm run test:surgery`, `npm run test:boxing`, `tests/premium.browser.ts`: pass. UI suite covers six routes at 1440/768/390, labels, filters/URL persistence, new-tab links, keyboard modal and reduced motion; zero contrast findings.
- Production smoke: all nine direct routes load, all lazy game bundles initialize, no page errors/failed requests or desktop overflow.
- Visual source lint: zero failures/warnings. Home and Games inspector: zero failures at 1440/768/390; two defended warnings each (large gallery headings, hover launch-arrow treatment). Before/after screenshots and reports: [visual](visual/).
- Literal asset checks: nine static references, none missing. Dynamic game paths are covered by the game browser suites and Rooftop asset checker.
- Credential signature and sensitive filename scan: no candidates in staged recovery files; private environment/runtime/configuration files excluded. This scan is not a proof against every possible secret format.

Earlier failures are retained as evidence: Notes used the wrong test port; Surgery referenced the removed Play nav item; premium audit serialized a missing tsx helper; Boxing had a timing failure under concurrent load (retry passed). Headless WebGL screenshot and route re-entry runs were intermittent. Screenshots are now optional via `--screenshots`; gameplay assertions are retained. Rooftop uses supported Canvas fallback in CI, with `--webgl` available; production WebGL initialization is separately checked. One recovered source has pre-existing trailing whitespace (`rooftop/chase.ts:13`); it was preserved verbatim rather than silently edited.

## Missing/inaccessible and remaining issues

- Original `JORATA_ENDLESS_DRIVE_COMPLETE_ASSETS.zip` is truncated. Separate recovery contains 56 CRC-verified complete entries; recovery stops at an incomplete grass texture. Intended full entry count is unknown because the central directory is absent. Other readable source ZIPs passed CRC checks.
- Missing registered /tmp worktrees and any former uncommitted contents: **NOT ACCESSIBLE — RECOVERY REQUIRED**. Committed histories remain available. Other Codespaces, Windows Downloads and browser localStorage are outside accessible scope.
- Raw embedded repository.bundle retained locally only. All its 27 referenced commits are already present and reachable from remote branches; [bundle audit](embedded-bundle-heads.json). Private env/config/data files remain local and are deliberately not backed up to public Git.
- Heavy WebGL test reliability on the headless software renderer remains limited; no real-device GPU/FPS or three-minute wall-clock Drive endurance claim is made.
- Historical root Next.js app and live account/messaging integrations are preserved, not retested or deployed as part of this gaming recovery.

## Next actions

Review the integration branch and screenshots. Check games on a real phone/laptop, request the complete damaged original driving pack if needed, and recover any missing external workspace files separately. Only then consider a main merge or deployment. Keep source archives in LFS and deploy the `jorata-game` directory.

Integration branch: [integration/jorata-recovery-20261026](https://github.com/Jorataa/Jorata/tree/integration/jorata-recovery-20261026). The subsequent motion upgrade is recorded in MOTION_REPORT.md and its own commit, on this same branch.
