# JORATA — Rooftop Escape asset pack

Original right-facing 2D parkour / fighting cutout assets. No artwork from Vector or other games is included.

## Open the previews

Extract the ZIP and open `assets/previews/index.html`. It has actor/action selection, playback, replay, frame scrubbing, loop override, checkerboard transparency and optional background/rooftop composition. It embeds metadata and loads local image paths; it does not require a server or network. Scene view is an asset demonstration, not a playable game. All standalone GIFs are playable previews.

Contact sheets:
- `previews/character_contact_sheet.png`: every frame of all 28 character animations.
- `previews/environment_contact_sheet.png`: all 16 environment objects and the 3 background composites.
- `previews/effects_contact_sheet.png`: all 10 effect / window animation sequences.

## Counts and dimensions

- Runner: 13 actions, 76 frames.
- Pursuer: 10 actions, 58 frames.
- Guard: 5 actions, 28 frames.
- Total characters: 3; 28 character sequences; 162 numbered character frame PNGs.
- Effects: 7 requested effects × 8 frames = 56 numbered PNGs, plus 3 optional window-bank loops × 4 frames = 12 PNGs.
- Total animation exports: 38 sequences, 230 numbered frame PNGs, 38 sprite sheets and 38 animated GIFs.
- Environment: 16 PNG objects, plus their 16 editable SVG sources.
- Backgrounds: 3 themes, each with 3 individual 1920×1080 parallax layers; 9 layers total, plus 3 composite reference previews.
- Additional files include 3 character statics, character component sources, metadata, integration helper and contact sheets. Numbered frame count excludes these additional PNGs.

Character canvas is 128×128. Placement anchor is (64,112); nominal standing ground baseline is y=112. Feet in locomotion and attack poses move naturally. Characters face right; flip the complete frame horizontally to face left. Flip relative hitboxes too. All artwork is RGBA with genuine alpha; antialiased edge pixels intentionally use intermediate alpha values. PNG is the authoritative source; GIF previews use an opaque checkerboard to show fades faithfully; only PNGs are used as game textures.

Environment grid is 32 px. Every object dimension is a multiple of 32. Character geometry is not restricted to that environmental tile grid.

## Timing and sprite sheets

Character and requested effect animations use 12 FPS. Three optional window-bank loops use 4 FPS. GIF delays are restricted to multiples of 10ms: alternating 80/90ms frame delays approximate 12 FPS; exact supplied delay arrays are recorded in metadata. Game engines should use the numeric FPS field, not GIF timing.

Sheets have at most 8 columns, zero margin, zero spacing and row-major frame order. If a future sheet has unused cells, ignore cells past frame_count. Animation loop flags follow the requested specifications, including looped fall and one-shot traversals, attacks and slide. Engine code decides when to leave a state.

## Animation method and limitations

Built-in imagegen created original source component designs. Source heads, torsos, upper arms, forearms, thighs and lower legs were isolated and normalized once, then attached to an original articulated skeleton. Each frame changes actual limb joints, posture and/or expression of movement. No entire still image was stretched to fake animation. Generated design source and isolated components are included under `source/`.

This is 2D cutout animation with fixed-length bones and authored keyposes, not hand-redrawn anatomy per frame. Some overlap at elbows, shoulders and hips is an expected cutout style characteristic. No permanent motion blur is baked into the sprites. Run alternates legs and arms; jumps include crouch/takeoff/tuck; attacks include windup/contact/recovery; vaults rotate the torso and tuck legs; climb frames move from reaching to pull-up/crouch/stand; roll rotates a curled articulated pose. Hurt and collapse are non-graphic.

Vault and climb are IN-PLACE POSE SEQUENCES. A real game must move the actor root along a collision-validated trajectory and use hand/foot attachment points to line up with the particular obstacle. These assets cannot independently guarantee traversal for arbitrary building geometry. The frame anchor stays consistent; the pack does not include physics, inverse-kinematic runtime obstacle fitting or a playable level. Foot placement/collision and attack boxes are integration starting values, not gameplay-certified parameters.

## Environment / collision contracts

`metadata/collisions.json` lists every object: dimensions, anchor, collider rectangles, type, interaction triggers and traversal flags. Rectangles use unscaled top-left texture coordinates. Subtract the object anchor before applying world placement. Use one scale consistently for image and colliders.

- `rooftop_middle`: seamless repeatable horizontal platform segment, collision top y=16.
- `building_facade`: decorative repeated wall, no automatic collision; combine it with explicit world platform/wall geometry.
- `wall_climbable` and `ledge_grabbable`: marked traversal surfaces; engine checks landing space.
- `low_barrier`, `vent`, `air_conditioner`: vaultable low objects.
- `slide_barrier`: overhead suspended beam. Its local floor is y=128; clearance below the beam is 68 px. Decorative cables are not solid.
- `water_tank` and `antenna`: background decoration, intentionally no collision.
- `chimney`: solid tall obstacle.
- `door` and `escape_exit`: interaction/exit triggers, no invisible solid door collider.
- Start/end rooftop raised caps are decorative; top collision remains y=16.

Editable SVGs are supplied for environment design adjustments. Exported PNGs and collision JSON are the integration contract. Source SVG strokes and raster sample coverage can differ by about one pixel at edges.

## Backgrounds and parallax

Each theme has an opaque sky and two transparent skyline layers. They are authored at 960×540 and exported at exactly 2× with nearest sampling. Their left/right edge pixels match, checked automatically. Repeat horizontally. Recommended parallax factors: sky .08, distant_city .30, near_city .60. These are static layers; there is no baked full-scene background animation. Optional window effects are separate small overlays to place on compatible facades manually.

## Attack data and engine use

Animation JSON includes zero-based active frames 2 and 3, relative attack rectangles for each active frame, windup/recovery frames, and recommended body collider / slide collider. Permit one hit per target per attack invocation. Attack rectangles are rough recommended tuning values; confirm them against your game’s sprite scale and movement.

Use `examples/canvas_integration.js` for sheet slicing, anchor placement, frame timing and environment collider conversion. For Phaser, load each sheet using frame_width/frame_height and create animations with numeric fps and repeat from loop. For PixiJS, slice rectangles using sheet_columns and make AnimatedSprites; apply anchor (64/128,112/128) for characters. Source parts and output are smooth flat/cutout art, so normal linear sampling is appropriate; do not apply motion blur.

## Quality control

`metadata/quality_control.json` records the checks actually performed: PNG decode, per-sequence uniqueness, no character clipping, alpha, baseline, sheet/frame equality, GIF frame counts and looping flags, all JSON paths, environment grid/collider validity, repeating background edges, manifest SHA-256 and ZIP CRC. Metadata paths are relative to `assets/`. `asset_manifest.json` lists every delivered file except itself, avoiding recursive hashes.

Manual visual review uses frame contact sheets and sample sequences. Automated file checks do not guarantee gameplay feel or runtime engine integration. Browser preview execution is reported separately from JavaScript syntax validation and should not be inferred from file checks.

Preview verification: embedded JavaScript syntax passed. A Node VM smoke test with DOM/canvas stubs loaded all 38 sequences from their actual file paths, exercised playback/frame scrubbing and scene composition. A real browser was unavailable, so this is not a browser rendering test. All PNGs and GIF frames were separately decoded and the contact sheets inspected.
