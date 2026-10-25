# JORATA — Endless Drive

Run from `jorata-game` with `npm install` and `npm run dev`. Open
http://localhost:3107/games/endless-drive or choose Endless Drive in Games.
There is no backend, login, or additional credential requirement.

## Assets and provenance

The supplied `Driving-game/JORATA_ENDLESS_DRIVE_COMPLETE_ASSETS.zip` is truncated:
its ZIP central directory is missing and its final recoverable local entry is
`04_terrain/textures/grass_basecolor.png` (incomplete). 56 complete local entries
were recovered. Its final README, integration/procedural/performance guides and
quality report are unavailable; they were not fabricated.

The intact `JORATA_VEHICLES.zip`, `JORATA_ENVIRONMENTS.zip`, and
`JORATA_UI_AND_SYSTEMS.zip` supply the runtime content. The subset README,
manifests, vehicle specs, material library, biome/quality/sky/weather presets,
procedural world helper and effects helper were inspected. Runtime binaries were
verified against the supplied manifest SHA-256 values: 211 GLB/PNG/SVG files,
zero missing files or mismatches. `public/drive/asset_manifest.json` combines the
three inventories. `public/drive/LICENSE.txt` preserves the pack license.

Authoring scripts and finite preview scenes are not shipped. `world.ts` and
`effects.ts` adapt the supplied browser runtime helpers, retaining their source
notice. No preview animation drives the vehicle. The game uses Three.js and its
GLTFLoader, loaded only when this route opens.

The GLB node translations, bounds and extras confirm meters, +Y up, -Z forward.
The six vehicles retain their original body, steering, wheel-spin and suspension
hierarchies. Per-vehicle camera anchors, wheel radius, wheelbase and paint material
come from manifest metadata. Paint changes only cloned paint materials; lights
also have private materials. Glass, tires and interior materials retain their
original appearance. GLTFLoader handles embedded GLB textures; terrain and road
base-color maps use sRGB, while normal and packed ORM maps remain linear.

## Controls and behavior

- W / Up accelerates; S / Down brakes and reverses after stopping.
- A / Left and D / Right steer the actual bicycle model.
- Space applies the strong brake; C cycles five cameras.
- R safely returns the vehicle to the road at the current location.
- Escape pauses/resumes, or closes an open settings drawer/companion first.
- Drag the scenery in Free look to orbit the vehicle.
- Narrow screens offer four held touch controls.

Manual acceleration/steering/braking disengages optional road-following autodrive.
Autodrive computes a lookahead steering error and limits speed based on upcoming
curvature. It advances the same vehicle simulation as manual input. Settings are
stored under `jorata-endless-drive`; distance/session position intentionally reset
when leaving the route. Vehicle switches retain the current driving session.

Inputs release on blur/visibility loss; hidden pages pause. Settings, quick notes
and the companion pause driving. Typing in editable fields does not drive the car.
The scene has a single RAF loop; simulation runs in steps of at most 1/60 second,
with bounded catchup after stalls. HUD telemetry updates about 2.5 times/second.

## World and resource ownership

The supplied global road profile curves and changes elevation in negative Z.
Chunk indices cover both directions around the vehicle: Low/Medium/High hold
exactly 5/7/9 chunks of 64 m each. A symmetric window also supports reverse and
turning around. Nothing teleports at the road's end. Road dashes use global Z,
not chunk-local phases. Vegetation uses a fixed seed and chunk index, excludes the
road corridor and steep slopes, and is instanced from supplied LOD models.

Roadside terrain uses the nearest road station and a wider flat verge to prevent
terrain cutting through shoulders. The playable strip is 320 m wide with a soft
outer boundary at ±142 m, keeping the vehicle on generated terrain. Large
structures use lightweight circle collisions, and mountain/coastal barriers limit
road departures. This is intentionally a relaxed kinematic driving model, not a
rigid-body or crash simulator.

Chunk disposal releases generated road/terrain geometry and instance buffers.
Shared GLB geometry/materials remain in a bounded asset cache. Switching content
loads each asset once; leaving disposes templates, textures, cloned paint/light
materials, effects, shadow targets and WebGL context, disconnects ResizeObserver,
and removes all input listeners and the animation loop.

Graphics presets use supplied DPR caps, shadow resolutions, terrain density,
active chunk counts and particle caps. Wind and water are bounded shader effects;
precipitation is one reusable particle buffer, replaced and disposed on changes.
Headlights are actual SpotLights with road illumination, not only emissive meshes.

## Jorata integration

The only shared changes are the lazy route `/games/endless-drive`, page title,
Games navigation state, and one game-library entry. Other games, notes and APIs
are preserved. The game disables the shared page entrance transform on its route
so its fixed scene occupies the browser viewport.

The existing robot artwork appears once in a `document.body` portal with fixed
viewport positioning. It can collapse, avoids touch controls, and hides behind the
settings drawer. Its driving guide is available offline. The existing AI endpoint
is explicitly surgery-scoped, so it is not sent unrelated driving context. The
original surgery robot and its AI service are unchanged. There is no new AI backend.

## Focused verification

With the dev server running:

```sh
npm test
npm run build
node --import tsx tests/drive.browser.ts
node --import tsx tests/drive.browser.ts --live
```

The focused browser check drives the actual simulation through keyboard events,
then runs six simulated minutes across chunk boundaries, verifies bounded resources,
all six rigs, all three biomes, five cameras, six weather/time presets, three
graphics presets, night lights, settings persistence, pause/focus, portal ownership,
route cleanup/reentry and 390 px layout. `--live` runs three wall-clock minutes
using the ordinary animation loop at 640×360, recording actual renderer statistics.
Artifacts and detailed results are written to `/tmp/jorata-drive-qa`.

This cloud runner uses Chromium/SwiftShader software rendering. Measurements here
are evidence for content, control and allocation behavior, not a laptop hardware
FPS guarantee. Low uses supplied LOD vegetation; the six detailed vehicles retain
their authored appearance. Simplified interiors and lightweight collisions remain
intentional limitations. There is no sound/music system or gamepad mapping.

## Recorded checks (2026-10-24)

- `npm test`: 23/23 existing tests passed.
- `npm run build`: TypeScript and Vite production build passed. Vite reports its
  usual large-chunk advisory for the lazy Three.js game and existing Phaser game.
- Three wall-clock minutes of the ordinary animation loop passed on a two-core
  Chromium SwiftShader/Vulkan software renderer at 640×360, Low: 806 m travelled,
  five active chunks, 13 textures, geometries stabilizing at 113. Sampled render
  totals: 122–145 draw calls and 101,278–138,290 triangles. This runner rendered
  slowly and is not representative of a laptop GPU; no 60 FPS claim is made.
- A separate six-minute simulation check travelled about 7.8 km while rendering
  samples at the current vehicle location; active chunks remained five and
  geometry/texture counts stayed bounded.
- Source design lint passed with one informational warning for the speedometer's
  two-digit number formatting. Screenshot review covered desktop, cockpit,
  night/snow, all environments, and the narrow layout/drawer.

Two simultaneous software-rendered browser runs crashed a screenshot target
in this constrained runner. Verification was resumed sequentially.
The design direction uses Jorata's existing Manrope/green palette, a framed canvas,
a flat settings sheet and compact instruments; the requested game transparency
and thin control borders take precedence over the design skill's generic defaults.

- Final full browser suite passed: zero JavaScript/console errors and zero failed
  requests; all content/settings, cleanup, persistence, narrow UI, companion portal,
  and Surgery/Notes/Mosslight smoke checks passed.

## Changed files

- `src/drive/Drive.tsx` and `drive.css`: game interface and viewport robot portal.
- `src/drive/engine.ts`, `model.ts`, `world.ts`, `effects.ts`, `pack.json`: renderer,
  driving model, bounded procedural world, asset metadata, and effects.
- `public/drive/`: original runtime assets, merged manifest, license and game cover.
- `docs/drive-pack/`: supplied source-only integration references.
- `src/main.tsx`, `src/ui/index.tsx`, `src/ui/GameCard.tsx`: lazy route and library entry.
- `package.json`, `package-lock.json`: Three.js, its development types, test scripts.
- `tests/drive.browser.ts`: focused playable-flow and endurance verification.

The full original pack guides remain unavailable because of the truncated archive;
the supplied HUD specification and portal example are preserved in `docs/drive-pack`.

- Design inspector: zero failures at 1440/768/390px. Its remaining compact-text
  warning concerns secondary 11–12px keyboard hints and units. Source lint also
  has zero failures. Initialization now keeps the canvas hidden until its camera
  and selected assets are ready, avoiding an unfinished terrain view while loading.
- A later regression rerun repeated the driving foundation, six simulated minutes,
  all six vehicles and environment loading, then the runner terminated it with
  SIGTERM. The earlier full content suite and three-minute live run completed.
