# Asset recovery and integration

- `audit-20261026.json`: every inspected branch file/blob/size and safe workspace file SHA-256 (43 starting refs; 1,156 workspace entries).
- `integration-files.json`: all 884 selectively recovered game files with source Git blob and destination.
- `runtime-assets.json`: 818 deployed public files with source, destination, SHA-256, size and PNG dimensions/transparency metadata.
- `asset-inventory.json`: all 123 premium ZIP members, extraction destinations/status, and original ZIP member inventories/integrity results.
- `driving-archive-salvage.json`: complete CRC-verified recoverable entries and exact stopping point for the damaged original driving ZIP.
- `static-verification.json`: literal asset reference check and proof that all 49 gameplay/Notes source files are unchanged from the recovery snapshot.

Original source archives are preserved in Git LFS on `backup/stash-recovery-20261026`; source ZIPs are deliberately excluded from deployed public folders. The original standalone Boxing ZIP remains on `backup/boxing-workspace-20261025`. The two old website ZIP source locations are preserved on `backup/workspace-recovery-20261025`; they are byte-identical.

The supplied premium emblem/favicon, responsive city hero, and Surgery/Boxing/Rooftop covers are website presentation assets. They never replace character sprites, surgery tools, video states, or game scenery. Original Mosslight SVG artwork and the existing Drive cover are retained. Sources and unused alternatives remain recoverable in the backups. No new artwork was generated or downloaded.

Runtime files retain their existing per-game directories (`boxing`, `drive`, `rooftop`, `surgery`, `fonts`); website artwork uses `brand` and `covers`. The duplicate `public/games/boxing/assets` tree was omitted from integration after confirming no recovered source references it. Nine remaining duplicate-content groups are retained because they belong to existing game manifests/contracts; moving them would create unnecessary gameplay risk.

`Driving-game/JORATA_ENDLESS_DRIVE_COMPLETE_ASSETS.zip` is truncated. The separate recovered ZIP contains 56 complete entries, each checked against the original local-header CRC and size; the next grass texture is incomplete. The central directory is missing, so the original intended full entry count cannot be proven. The original is unchanged. Complete runtime drive assets also exist in the newer recovery snapshot, but that does not repair the original archive.

All other readable original ZIPs passed CRC integrity checks. The opaque `rebuild-backups/repository.bundle` remains only in the original local stash and is explicitly excluded from remote backup until inspected. Private environment/configuration/data files remain local. Generated dist/.vercel media contained no unique files versus the source snapshot. External Codespaces, missing /tmp worktrees, Windows Downloads and private browser saves are outside accessible recovery scope.
