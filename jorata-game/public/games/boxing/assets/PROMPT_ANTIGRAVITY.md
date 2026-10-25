# ANTIGRAVITY — JORATA BOXING ASSET INTEGRATION AND GAME BUILD

You are a senior 2D gameplay engineer and pixel-art UI designer. Build a fully playable boxing game inside the existing Jorata website using the ZIP `JORATA_BOXING_ASSETS.zip` that I am providing. The ZIP is the visual source of truth: **USE THESE ACTUAL PNGS** rather than drawing unrelated placeholders or changing the art style.

## Non-negotiable multi-agent isolation
Codex is working simultaneously on Jorata AI Assistant. First inspect the repo's working tree. Do NOT checkout or change branches in the Codex workspace. Create **your own Git worktree** on `feat/boxing-game` or isolated clone. Work only there. Never overwrite AI Assistant or unrelated files, never run destructive git commands. Do not merge until authorized. Make the game accessible at `/games/boxing` and avoid touching shared navigation if another agent is modifying it; document the link addition instead.

## Asset work
1. Extract the ZIP inside your isolated worktree, ideally to `public/games/boxing/assets/`.
2. Read `README.md` and `manifest.json` before coding. The `references/` source atlases are backup reference, not sprites to render directly.
3. Use `backgrounds/ring/ring_background_full.png` as the stage; render fighters in front, align their ground position with the ring surface. On resize maintain aspect ratio and letterbox rather than stretching.
4. Use each character PNG by its exact filename. P1=red faces right; P2=blue faces left, by horizontally flipping its texture. Make both fighter canvases the same size and anchor at the feet. Do not scale individual states differently, or characters will jitter.
5. States: idle(01/02), walk(01/02), jab(01/02), hook(01/02), uppercut(01/02), block, duck(01/02), hit(01/02), ko, win. These are reference poses, **not full animation loops**. Generate transitions/tweening (subtle bob, movement, windup, hold, recovery). If possible create intermediate tween frames while preserving pixel shapes and fighter proportions.
6. Use `effects/` for hit sparks, punch arcs, knockback, and dust. Use `ui/` for fighter portraits, VS, KO/WIN/DRAW and ring indicators, but implement live health/timer/stamina as responsive game/CSS UI when necessary. Use props as decorative arena objects or menus only where they fit.
7. Do not render reference filenames/crop labels/checkerboard texture. Check alpha on dark and light backgrounds. Trim residual halos only if necessary, without erasing body details. Keep crisp nearest-neighbor sampling.

## Playable game
Create **TWO MODES**: (A) solo vs fair offline game AI (Easy/Normal/Hard), (B) **LOCAL 1v1 on one laptop with one shared keyboard**. NO network multiplayer required. NO Gemini for enemy decisions.

Exactly four essential controls per player:
P1 RED — A/D movement, W block, F punch.
P2 BLUE — ←/→ movement, ↑ block, L punch.
Automatic punch combo cycles jab -> hook -> uppercut based on timing, with cooldowns and stamina. Avoid awkward multiple punch buttons and simultaneous-key ghosting; allow remapping where useful.

Implement frame-rate-independent movement, grounded collision and spatial hitboxes (not just visual overlaps), stamina and health, fair input windows, block, damage, hit stun, knockback, KO, round timer, best-of-3 winner, draw logic, pause, restart, rematch, main menu, mode selection, How to Play. Both humans must be able to press controls concurrently without taking turns. Make AI show human-like timing and mistakes; no instant omniscient reactions. Keep controls functional when browser focus changes.

Make the game feel high-quality: clean premium menu, coherent arena, readable HUD, crisp sprite visuals, light screen shake on hard punches, restrained hit feedback, 60fps target, no excessive neon/gradients. Prioritize fully functioning gameplay over showy features.

## Definition of done
Run dev/build/test commands appropriate to the existing repo; manually test both modes, combo reset, simultaneous keyboard input, block and stamina, KO and rematch, and resizing. Verify assets actually load (no broken paths). Commit only game files on `feat/boxing-game`. Return game route, changed files, tests, screenshots if possible, and commit hash; explain how to integrate without disturbing Codex. Do not claim missing animations as if they exist: add procedural tweening for short sprite sets.

**Do the implementation, not just a plan or mockup.**
