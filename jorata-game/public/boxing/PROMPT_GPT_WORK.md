# GPT WORK — QUALITY ASSURANCE AND POLISH FOR JORATA BOXING ASSETS

Take the attached ZIP `JORATA_BOXING_ASSETS.zip`. This is an existing separated raster asset pack. Do not make a new random redesign or rename the current files without preserving compatibility.

1. Audit every PNG against `references/source_organized.png`, original source and `manifest.json`. Check that filenames correspond exactly to poses and game roles, and that sprite images contain no text or mislabeled neighbors.
2. Clean checkerboard remnants and pale halos, keep the original pixel-art appearance, and preserve body/glove details. Use RGBA transparent backgrounds for all characters, props, UI, effects, and ring layers. Background arena files should remain opaque.
3. Standardize sprite positioning across all frames: 160x160 RGBA canvas for each fighter, centered horizontally, feet aligned to a constant baseline, no scaling changes among states. Keep KO poses on the same baseline.
4. For idle, walk, jab, hook, uppercut, duck, hit, block, KO, win, extend sequences into smooth readable animation cycles if feasible, without radically redrawing characters. Store additions as numbered frames under matching state names and document which ones were added. If generating more images, avoid changing character identity, palette, proportions or facing direction. Don't just duplicate an identical frame and call it animation.
5. Export optional sprite sheets plus machine-readable JSON per fighter, but preserve the individual PNGs and `manifest.json` paths for backward compatibility.
6. Inspect and repair ring/background compositing where useful; avoid cropping or stretching UI onto the playable stage.
7. Build a visual contact sheet that lists every sprite for QC. Add a short `QUALITY_REPORT.md` stating which sprites were unchanged, cleaned, interpolated or still need manual art, and provide one final downloadable ZIP. Never claim transparency or correct animations without inspecting the actual files.

Game integration requirements: local 1v1 on one laptop shared keyboard. P1 A/D/W/F, P2 ←/→/↑/L; automatic combo changes. Codex is working in parallel on an AI Assistant, so tell Antigravity to use a separate Git worktree when importing this pack.
