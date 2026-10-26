# JORATA — Rooftop Escape

Open `/games/rooftop-escape`, or choose **Rooftop Escape** in Games.

```sh
cd jorata-game
npm install
npm run dev
```

Default local address: http://localhost:3107/games/rooftop-escape . No account, server service, API key, or external assets are needed. The optional surgery assistant elsewhere in JORATA is unrelated to this game.

## Controls

- Space / Up: jump; hold briefly for more height. The same input vaults low obstacles and grabs marked ledges.
- S / Down: slide. Hold to stay low; release restores standing only after clearing the beam.
- J / X: contextual punch, ground kick, or aerial kick. A strong hit knocks out a guard.
- R: immediate retry at the current checkpoint. Escape: pause / resume.
- Touch: three large buttons below the view; holding Jump works like the keyboard.
- Mute and Reduced effects are saved locally. Focus loss pauses; resuming requires an explicit action.

## Implementation

Phaser handles loading, sprites, animation, camera, effects and rendering. The game is lazy loaded so the library, Mosslight and Surgery do not load Phaser.

`src/rooftop/levels.ts` contains three finite authored routes. Each has fifteen rooftops, two safe checkpoints, a distinct theme and a clear exit. Tested clean completion times are approximately 69s, 67s and 66s. `movement.ts` handles a fixed 120 Hz simulation, acceleration, variable jump height, 100ms coyote time, 120ms buffering, smaller slide/roll bodies, collision checks, validated vaults, marked ledge climbs and responsive landing recovery. `combat.ts` uses the pack's active frames and anchor-relative hitboxes. `chase.ts` moves a separate actor through the same route using physical movement and traversal markers. There is no player-relative pursuer teleport.

`model.ts` owns health, checkpoint snapshots, chase capture, flow, score and transitions. `scene.ts` presents those states with the supplied animations. `Rooftop.tsx` provides navigation, menus, HUD and keyboard/pointer lifecycle. A short-lived, bounded sprite pool supplies dust and sparks; Web Audio cues are created only after a start/resume gesture and are disconnected after use. Settings, unlocks and best scores use versioned local storage; storage denial does not prevent playing.

## Asset audit

Source: `game design surgery/jorata_rooftop_escape_assets.zip`.

Archive entries were rejected if absolute, traversing outside extraction, or symlinks. Extracted assets live under `public/rooftop/assets`. All 384 manifest files passed byte length and SHA-256 checks. All 38 sheets were checked against frame dimensions, row/column counts and frame counts; all referenced frame paths and all 16 environment collider contracts were checked. Character placement uses the pack's (64,112) anchor and 12 FPS. Platform images are offset by the metadata's 16px collision top. Standing/slide bodies use the supplied 76px standing height and the beam's documented 68px clearance. Attacks use the exact per-frame metadata rectangles; the smaller slide body is deliberately tuned to 34px.

Original runner, guard and pursuer sprites remain distinct. All nine background layers and supplied environment/effect art are used locally. No replacement character or environment artwork was required. The pack has no audio: jump, landing, strike, damage, checkpoint, traversal, danger and ending sounds are locally synthesized replacements.

## Verification

```sh
npm run test:rooftop
npm run test:rooftop:browser
npm test
npm run build
```

The browser script defaults to http://localhost:3112; set `TEST_BASE_URL=http://localhost:3107` for a default server. Chromium must be installed for Playwright. Screenshots are written to `/tmp/jorata-rooftop-qa`.

Focused tests check complete traversal of all three routes, physical pursuer continuity, reachable gaps, slides, vaults, climbs, one hit per strike, every guard's defeat, both checkpoints, 30 resets per route, variable jump height, coyote/buffer timing, overhead clearance, capture telegraphing, pause and transient-state reset. Existing Mosslight/Surgery checks run separately.

The Chromium test completes every level through actual keyboard event handlers using accelerated Phaser simulation frames; it does not teleport actors or skip route sections. It also checks keyboard jumping, Escape, focus loss, pointer-held jumping, 20 repeated retries, local persistence, navigation teardown/re-entry, missing asset requests and browser errors. Desktop, portrait phone and landscape phone screenshots provide visual evidence.

## Limits

This is a finite MVP with one-hit guard knockouts and contextual combat, rather than a multi-combo fighting game. The supplied cutout animations do not include a dedicated pursuer slide; the pursuer uses a low vault pose while its smaller body physically slides under the beam. Human difficulty tuning and device-specific 60 FPS profiling remain useful follow-up work. Automated accelerated browser completion is not a claim of a human real-time playthrough or a measured 60 FPS guarantee. Phaser's lazy game chunk produces Vite's large-chunk advisory; it does not affect build success.

Verified delivery: all nine focused checks pass; all fifteen existing unit checks pass; the main application production build passes; all three keyboard-driven Chromium routes complete with full health, two checkpoints and all guards defeated. Touch, focus pause, persistence, twenty retries, navigation and re-entry pass with no browser exceptions or failed asset requests. The design inspector reports zero failures at 1440, 768 and 390px; its title-size warning is intentional for a game's start screen. The final source in the main app matches the verified feature worktree.

Two existing verification issues were corrected with small test-only edits: an implicit Surgery test variable type and a motion-setting selector that matched both the global button and the checkbox. Existing runtime features were preserved. Development took place on `feature/rooftop-escape` in `/tmp/jorata-rooftop`; the additions and targeted navigation changes are also integrated into the original app without switching its branch.
