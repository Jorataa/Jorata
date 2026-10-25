# JORATA recovery audit

Audit date: 2026-10-25. Scope: this Codespace, all fetched origin branches, local branches and registered worktrees. No other Codespace was available. This is an evidence inventory, not a claim that all features work.

## Starting state

- Active branch: main at f79dfcb903acd4a79a75827e11a912a863c295d2; 11 modified tracked files and substantial untracked gaming code/assets. Full safe-file hashes and branch deltas: `recovery/initial-inventory.json`.
- Origin fetched successfully without pruning. 29 local/remote refs inspected by recursive trees and differences against codex/jorata-play-notes.
- PROJECT_CONTEXT.md describes the historical productivity product. The current explicit instruction selects gaming + personal notes. Historical productivity and messaging implementations remain recoverable; no messaging feature will be reintroduced into the gaming UI.

## Branches inspected

| Ref | Commit | Files | Game source files | Assets | Changed paths vs play-notes |
| --- | --- | ---: | ---: | ---: | ---: |
| refs/heads/backup/pre-play-notes-20261022 | f79dfcb903acd4a79a75827e11a912a863c295d2 | 266 | 0 | 10 | 107 |
| refs/heads/backup/pre-premium-consolidation-20261025 | f79dfcb903acd4a79a75827e11a912a863c295d2 | 266 | 0 | 10 | 107 |
| refs/heads/boxing-game | b75c59d69f737ad46718d9b5ddd038c386155603 | 221 | 6 | 12 | 0 |
| refs/heads/codex/jorata-ai-hardening | 98a9e4154494821e1734005aa2ca75ca49436afa | 266 | 0 | 9 | 107 |
| refs/heads/codex/jorata-play-notes | b75c59d69f737ad46718d9b5ddd038c386155603 | 221 | 6 | 12 | 0 |
| refs/heads/codex/jorata-premium-ui | 2b58bde8c45794a05632a1252967b60604a9156c | 254 | 0 | 9 | 95 |
| refs/heads/codex/jorata-secure-ai | d0836b93c072e8bdec13de072214bd527047e87b | 263 | 0 | 9 | 104 |
| refs/heads/driving-game | c11c2f1a906b52fe86b0eff28e0805c2e7a2b6c8 | 223 | 6 | 13 | 2 |
| refs/heads/feat/boxing-game | b75c59d69f737ad46718d9b5ddd038c386155603 | 221 | 6 | 12 | 0 |
| refs/heads/feature/rooftop-escape | b75c59d69f737ad46718d9b5ddd038c386155603 | 221 | 6 | 12 | 0 |
| refs/heads/main | f79dfcb903acd4a79a75827e11a912a863c295d2 | 266 | 0 | 10 | 107 |
| refs/remotes/origin/claude/dashboard-error-onboarding-3c1vuh | a0b0152e94dfbdc8cb8e4d38cf0b2dbd9c9127a8 | 148 | 0 | 5 | 221 |
| refs/remotes/origin/claude/google-site-verification-ibxugg | 03d390dbc4b41b13bb56ec70acc306dbca2661e8 | 160 | 0 | 5 | 212 |
| refs/remotes/origin/claude/jorata-ai-descriptions-review-6q6b5k | 1ec2bef89be8562a0af711bcd663f51e9f36d4c4 | 169 | 0 | 6 | 200 |
| refs/remotes/origin/claude/jorata-audit-onboarding-o8mbz9 | ad191cf3c1082dcdda4c1fe2c5a7577493f8796f | 161 | 0 | 5 | 213 |
| refs/remotes/origin/claude/jorata-opt-in-cloud-sync-sdbhbd | d2c9e73ac7688aca2e40c3b19501c4a705234d28 | 160 | 0 | 5 | 212 |
| refs/remotes/origin/claude/jorata-orbit-logo-cbgldh | 1d7e75401621377503537b76af80cd5f005b245a | 164 | 0 | 6 | 204 |
| refs/remotes/origin/claude/jorata-visual-redesign-grlx78 | d05f733c357553d3a6159e2905fd18134a33579b | 169 | 0 | 6 | 200 |
| refs/remotes/origin/claude/security-audit-comprehensive-8b739e | 1f8d77ac81a892593124a171422ea41788da3155 | 162 | 0 | 5 | 213 |
| refs/remotes/origin/claude/security-audit-pentest-0wmthg | 12c936da00dc125670f21bdbb08dbc0d59e8d45b | 161 | 0 | 5 | 212 |
| refs/remotes/origin/claude/security-audit-pentest-jptefa | f8047b72aa34f67540ab6405a0cee349b23a2bfd | 162 | 0 | 5 | 205 |
| refs/remotes/origin/codex/jorata-guest-core | 11001c2268a3efd2d8254de192c41c944452f5aa | 249 | 0 | 9 | 90 |
| refs/remotes/origin/codex/jorata-play-notes | b75c59d69f737ad46718d9b5ddd038c386155603 | 221 | 6 | 12 | 0 |
| refs/remotes/origin/codex/jorata-secure-ai | d0836b93c072e8bdec13de072214bd527047e87b | 263 | 0 | 9 | 104 |
| refs/remotes/origin/codex/jorata-social-v2 | f1341aa3d0dfda84c1ca77b0cfac86c5411dc86b | 240 | 0 | 9 | 81 |
| refs/remotes/origin/deploy/vercel-build-fix | e4630b7d04bcc8a491e232e5388be8a1d09a834b | 134 | 0 | 5 | 256 |
| refs/remotes/origin/main | f79dfcb903acd4a79a75827e11a912a863c295d2 | 266 | 0 | 10 | 107 |
| refs/remotes/origin/vercel/install-vercel-web-analytics-i-ho5cb4 | fa34b52fb623fc53098d05882d4a80138ca1076b | 148 | 0 | 6 | 102 |
| refs/remotes/origin/vercel/install-vercel-web-analytics-i-y4hbjx | feada411736a8373ddb6157dfe44d72e2782628d | 129 | 0 | 5 | 242 |

## Foundation decision

`codex/jorata-play-notes` b75c59d is the clean gaming foundation: local Notes, Mosslight, site shell, no messaging backend. Current uncommitted workspace contains later Surgery, Boxing, Rooftop and Drive implementations. Integrate those selectively after backup; do not merge the messaging/security branches. `driving-game` c11c2f1 adds a 33.8 MB ZIP snapshot (256 entries, integrity verified); its embedded implementations must be compared too.

## Implementations located (verification pending)

| Area | Source | Initial observation |
| --- | --- | --- |
| Mosslight / Sandbox | jorata-game/src/play; play-notes branch | Canvas engine, model, browser and unit tests, browser storage |
| Surgery | jorata-game/src/surgery, public/surgery | Disease/case models, tools, video states, optional server assistant |
| Boxing | jorata-game/src/boxing; nested boxing-game worktree | Current root has key rebinding/anti-ghosting; nested worktree has alternative menu/audio UI. Preserve both, keep current controls. |
| Rooftop Escape | jorata-game/src/rooftop, public/rooftop | Phaser scene, model tests, animated sprites/frames, browser test |
| Endless Drive | jorata-game/src/drive, public/drive; driving-game ZIP | Three.js engine, GLBs, biome data, browser test |
| Notes | jorata-game/src/notes | Browser storage, editor, quick capture, import/export tests |
| Other apps | root src; jorata-game/src/social and server on main | Historical productivity/messaging source; not additional verified games |

## Worktrees and access

- `/workspaces/Jorata`: accessible; safe uncommitted files require backup.
- `/workspaces/Jorata/boxing-game`: accessible, dirty, ignored by parent Git. Requires independent dated backup. Includes JORATA_BOXING_ASSETS.zip and alternative Boxing UI.
- `/workspaces/jorata-secure-ai`: accessible and clean; committed history recoverable. Secret env files stay local.
- `/tmp/jorata-ai-hardening`, `/tmp/jorata-guest-release`, `/tmp/jorata-premium-ui`, `/tmp/jorata-rooftop`: registered paths missing. Git commits remain available; any formerly uncommitted files are **NOT ACCESSIBLE — RECOVERY REQUIRED**.
- Other Codespaces, Windows Downloads, external upload originals and browser localStorage: **NOT ACCESSIBLE — RECOVERY REQUIRED**.

## Asset inventory and duplicate findings

- 1249 visual/media/archive files inventoried across accessible workspaces (includes duplicate copies and generated QA images). Each has source path, size and SHA-256; PNGs have dimensions/color type; ZIPs have member lists and integrity results.
- `Design game/jorata-website-assets (1).zip` and `Design website/jorata-website-assets (1).zip` are byte-identical. Preserve both source locations in backup, use one deployed destination.
- `Design website/jorata_premium_assets.zip`: supplied branding, responsive game covers, backgrounds and UI assets; ZIP integrity verified. Inspect actual artwork before use.
- `public/boxing` and `public/games/boxing/assets` duplicate many binaries. Keep existing runtime references until tested; Git deduplicates identical blobs.
- Existing game assets already have readable per-game directories. Avoid disruptive relocation; new website assets will live under public/brand and public/covers.
- Large source archives can use Git LFS (available: 3.8.0); no asset exceeds GitHub’s 100 MB hard limit. Preserve binary originals.

## Exclusions and known limitations

- Secret env files, private runtime JSON, credentials and local service configuration are excluded from commits and retained locally. Do not print their contents. No credential signature candidates found by initial pattern scan; this is not a proof that no secret can exist.
- Dependencies/build outputs and generated QA artifacts are not source backups. Original local copies are retained.
- Build, route behavior, media loading, Notes persistence and mobile control checks have not yet been run in this recovery session. Historical verification documents are not current evidence.
- Some existing browser tests assume two games although the current library has five; reconcile assertions with actual catalog without weakening gameplay checks.
- Optional assistant behavior requires server credentials; do not claim live AI verification without them.

## Backup and final verification

Pending. Will be updated only after remote SHA checks and actual test runs.
