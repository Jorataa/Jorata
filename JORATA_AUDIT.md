# JORATA repository recovery audit

Audit date: 2026-10-26. This audit covers fetched local/remote Git trees, the local stash and two accessible workspaces. Runtime results are pending; historical reports are not current verification.

## Starting state

Clean main at `f79dfcb903acd4a79a75827e11a912a863c295d2`. Nested Boxing worktree is clean. Secure AI worktree has only an untracked dependency symlink. Fetch succeeded without pruning. Original .git is sandbox read-only; Git mutations require the existing escalation mechanism.

## Branches inspected

| Branch/ref | Commit | Files |
| --- | --- | ---: |
| refs/heads/backup/boxing-workspace-20261025 | 12a7d1d2f287 | 541 |
| refs/heads/backup/pre-play-notes-20261022 | f79dfcb903ac | 266 |
| refs/heads/backup/pre-premium-consolidation-20261025 | f79dfcb903ac | 266 |
| refs/heads/backup/workspace-recovery-20261025 | 64c8e01709a6 | 1270 |
| refs/heads/boxing-game | b75c59d69f73 | 221 |
| refs/heads/codex/jorata-ai-hardening | 98a9e4154494 | 266 |
| refs/heads/codex/jorata-play-notes | b75c59d69f73 | 221 |
| refs/heads/codex/jorata-premium-ui | 2b58bde8c457 | 254 |
| refs/heads/codex/jorata-secure-ai | d0836b93c072 | 263 |
| refs/heads/driving-game | c11c2f1a906b | 223 |
| refs/heads/feat/boxing-game | b75c59d69f73 | 221 |
| refs/heads/feature/rooftop-escape | b75c59d69f73 | 221 |
| refs/heads/integration/jorata-recovery-20261025 | b75c59d69f73 | 221 |
| refs/heads/main | f79dfcb903ac | 266 |
| refs/remotes/origin/HEAD | f79dfcb903ac | 266 |
| refs/remotes/origin/backup/boxing-workspace-20261025 | 12a7d1d2f287 | 541 |
| refs/remotes/origin/backup/pre-play-notes-20261022 | f79dfcb903ac | 266 |
| refs/remotes/origin/backup/pre-premium-consolidation-20261025 | f79dfcb903ac | 266 |
| refs/remotes/origin/backup/workspace-recovery-20261025 | 64c8e01709a6 | 1270 |
| refs/remotes/origin/boxing-game | b75c59d69f73 | 221 |
| refs/remotes/origin/claude/dashboard-error-onboarding-3c1vuh | a0b0152e94df | 148 |
| refs/remotes/origin/claude/google-site-verification-ibxugg | 03d390dbc4b4 | 160 |
| refs/remotes/origin/claude/jorata-ai-descriptions-review-6q6b5k | 1ec2bef89be8 | 169 |
| refs/remotes/origin/claude/jorata-audit-onboarding-o8mbz9 | ad191cf3c108 | 161 |
| refs/remotes/origin/claude/jorata-opt-in-cloud-sync-sdbhbd | d2c9e73ac768 | 160 |
| refs/remotes/origin/claude/jorata-orbit-logo-cbgldh | 1d7e75401621 | 164 |
| refs/remotes/origin/claude/jorata-visual-redesign-grlx78 | d05f733c3575 | 169 |
| refs/remotes/origin/claude/security-audit-comprehensive-8b739e | 1f8d77ac81a8 | 162 |
| refs/remotes/origin/claude/security-audit-pentest-0wmthg | 12c936da00dc | 161 |
| refs/remotes/origin/claude/security-audit-pentest-jptefa | f8047b72aa34 | 162 |
| refs/remotes/origin/codex/jorata-ai-hardening | 98a9e4154494 | 266 |
| refs/remotes/origin/codex/jorata-guest-core | 11001c2268a3 | 249 |
| refs/remotes/origin/codex/jorata-play-notes | b75c59d69f73 | 221 |
| refs/remotes/origin/codex/jorata-premium-ui | 2b58bde8c457 | 254 |
| refs/remotes/origin/codex/jorata-secure-ai | d0836b93c072 | 263 |
| refs/remotes/origin/codex/jorata-social-v2 | f1341aa3d0df | 240 |
| refs/remotes/origin/deploy/vercel-build-fix | e4630b7d04bc | 134 |
| refs/remotes/origin/driving-game | c11c2f1a906b | 223 |
| refs/remotes/origin/feat/boxing-game | b75c59d69f73 | 221 |
| refs/remotes/origin/feature/rooftop-escape | b75c59d69f73 | 221 |
| refs/remotes/origin/main | f79dfcb903ac | 266 |
| refs/remotes/origin/vercel/install-vercel-web-analytics-i-ho5cb4 | fa34b52fb623 | 148 |
| refs/remotes/origin/vercel/install-vercel-web-analytics-i-y4hbjx | feada411736a | 129 |

## Recovery decisions

- Start from codex/jorata-play-notes b75c59d. Recovery backup 64c8e01 contains newer five-game code and assets; select its gaming subtree rather than merge messaging history.
- Backup 12a7d1d preserves the independent Boxing implementation and original ZIP.
- Local stash becbe8a has 1056 untracked-tree files including additional original driving, surgery, rooftop, branding and website ZIPs. Preserve safe source/assets on a dated backup; embedded bundle/patch require separate secret inspection.
- Root Next.js productivity app and historical messaging/security branches stay recoverable. Current product follows the explicit gaming + Notes brief.

## Located implementations

| Game | Implementation | Initial status |
| --- | --- | --- |
| Mosslight | play-notes: jorata-game/src/play | Canvas engine/model/storage; runtime pending |
| Surgery | backup 64c8e01: src/surgery + public/surgery | Cases/tools/video + optional assistant; runtime pending |
| Boxing | backup 64c8e01 and independent backup 12a7d1d | Differing controls/UI; retain newer root controls; runtime pending |
| Rooftop Escape | backup 64c8e01: src/rooftop + public/rooftop | Phaser/model/sprites; runtime pending |
| Endless Drive | backup 64c8e01: src/drive + public/drive; driving-game ZIP; stash | Three.js/GLB/biomes; compare source variants; runtime pending |

## Assets and exclusions

Full branch path/blob/size inventory and workspace SHA-256/PNG metadata: recovery/audit-20261026.json. Original ZIPs retained. Byte-identical artwork will keep one runtime destination; no originals overwritten. LFS 3.8.0 is available. Private .env files, data JSON, credentials, local deployment config and dependencies are excluded and retained locally. Generated dist/.vercel copies are not original source; any unique public assets will be compared by hash.

## Inaccessible work

Registered /tmp/jorata-ai-hardening, /tmp/jorata-guest-release, /tmp/jorata-premium-ui, /tmp/jorata-rooftop and /tmp/jorata-recovery-integration paths are missing: NOT ACCESSIBLE — RECOVERY REQUIRED for formerly uncommitted files; their committed histories remain available. Other Codespaces, Windows Downloads and browser localStorage: NOT ACCESSIBLE — RECOVERY REQUIRED.

## Verification and backup status

Verified remote backups: workspace `f1c31a0`, stashed originals + salvage `5181ffb`, previous complete game snapshot `64c8e01`, independent Boxing `12a7d1d`. Fresh LFS fetch: 14 objects, 205,226,279 bytes, all SHA-256 checks pass. Main and play-notes SHAs are unchanged. No deployment or merge.

Selectively recovered 884 compatible gaming files; inventoried 818 runtime public files and 13 source archives (including the separately salvaged archive). All 49 game/Notes source files match the newer snapshot. Presentation uses supplied premium art; no new artwork was generated. Legacy social/server/Supabase code was excluded from the gaming build.

Production gaming build and 23 core + 9 Rooftop unit tests pass. Product/Mosslight/Notes, Surgery, Boxing and UI browser checks pass. All nine production routes and game bundle loads pass with no page errors/failed requests. Rooftop desktop route completion and focused mobile controls pass; final full-suite harness verification is tracked in recovery/RECOVERY_REPORT.md. Headless WebGL screenshot/re-entry reliability limits are documented there.

One original driving ZIP is truncated; 56 CRC-verified entries salvaged separately, source unchanged. Raw repository.bundle remains local, but all its 27 commit refs were confirmed present and reachable from remote branches. Full files, results, exclusions and next actions: recovery/RECOVERY_REPORT.md.
