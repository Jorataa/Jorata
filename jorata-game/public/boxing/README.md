# JORATA BOXING — ASSET PACK

A separated image asset pack for Jorata Boxing. All sprite, UI, effect, and prop images are PNG with transparent backgrounds; scene backgrounds are opaque PNG.

## Directories
- `characters/player_red/` — Red fighter, standardized 160x160 transparent sprites.
- `characters/player_blue/` — Blue fighter, standardized 160x160 transparent sprites.
- `effects/` — Hits, punch trails, dust, impact effects.
- `ui/` — Health/stamina/round/result visuals.
- `backgrounds/ring/` — 2 static arena backgrounds and transparent compositing layers.
- `props/` — 10 set-dressing props.
- `references/` — Both original atlases retained for repair and comparison.
- `manifest.json` — Per-asset filenames, dimensions, source rectangles, labels.
- `PROMPT_ANTIGRAVITY.md` — Prompt for coding/game integration.
- `PROMPT_GPT_WORK.md` — Prompt for further animation cleanup and export.

## Usage notes
- Actual boxing movements are **not complete animation cycles**. For example `idle_01` and `idle_02` are two poses. Additional frames or procedural interpolation are recommended.
- Red and blue currently face **RIGHT** in the atlas. Flip the right-hand fighter horizontally in the game engine.
- The original sheet is raster with a drawn checkerboard. The export uses an automated background removal method; manually QC edges on dark and light backgrounds before production.
- In Jorata, prioritize same-keyboard multiplayer. Suggested P1: A, D, W, F. P2: Left, Right, Up, L. Punch combos are automatic. Check keyboard rollover on the actual device.
- UI artwork is optional: use CSS-rendered health/stamina bars where dynamic values must be smoothly updated.
- Prefer the full-size `ring_background_full.png` as the base arena. The secondary background is a low-res alternative.
- Keep Codex (AI Assistant) and Antigravity (Boxing Game) in **different Git worktrees**. This ZIP contains no project code, so extraction is safe within Antigravity's isolated workspace.
