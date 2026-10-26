# JORATA motion upgrade — 2026-10-26

Implemented on `integration/jorata-recovery-20261026`, after the remotely verified recovery checkpoint [0df7ddc](https://github.com/Jorataa/Jorata/commit/0df7ddc5cf383e746c10c7804b2737c6d00db117). Main and all original source/backup branches remain untouched. No production deployment.

## Effects

- Minimal pixel cursor with one trailing pixel and contextual Play/Move states. Its requestAnimationFrame loop ends when the pointer settles; native pointer returns for fields, games, touch/small viewports, reduced motion, data saving and opt-out. Layers cannot intercept clicks.
- Magnetic button contents travel at most 3px while the real hit area stays fixed. Game covers tilt at most 1.5 degrees, with a restrained edge highlight. Ordinary game cards remain ordinary links.
- Existing Surgery video and Rooftop/Boxing sprite assets appear only after desktop hover or keyboard focus. Video is muted/looping/playsInline/preload none with a poster; it pauses when inactive, hidden or offscreen. No game engine is mounted by a gallery preview. Original Mosslight SVG movement is paused outside active preview; Drive retains its static artwork with subtle hover zoom.
- Existing hero art gets slow desktop atmosphere and bounded 5px pointer parallax. Offscreen atmosphere stops. Small viewports keep static hero artwork. Section reveals use native Web Animations and never hide content while waiting for script.
- The nav indicator follows real active links and resize. Press states, pixel loading motion, Quick Note entrance/exit and drag elevation share a small timing system.
- Existing Notes drag/drop gets valid target feedback, source elevation/rotation and FLIP reorder settling. DataTransfer, storage and reorder behavior are untouched. Dragged Quick Note retains its real position and restores keyboard focus, so Escape remains usable. No game cards or buttons were made draggable.

## Files and assets

New: `src/motion/{Cursor.tsx,GamePreview.tsx,preferences.ts,useSiteMotion.ts,motion.css}`, `tests/motion.browser.ts`.

Integrated via `src/main.tsx`, `src/ui/GameCard.tsx`, a text wrapper in `src/Home.tsx`, preference copy in `src/Settings.tsx`, and a `test:motion` package script. The old interaction hook remains preserved but is no longer mounted. No dependency or artwork replacement. Exact media usage: [motion-asset-usage.json](motion-asset-usage.json).

All **49 game and Notes source files remain unchanged**, including every game engine, physics/controls, Notes UI/storage and save keys. [static-verification.json](static-verification.json) records the byte comparison.

## Performance and accessibility

No animation library added. The entry JavaScript bundle grows from 80.41 kB to 83.54 kB gzip in the measured builds (about 3.1 kB). Pointer writes are batched; resting cursor has no running frame loop. Observers and event handlers are cleaned up on route/preference changes. Preview sprites animate only while active. User and system preferences have priority, and Save-Data disables optional effects. Text fields keep their native cursor; overlays are aria-hidden/pointer-events none; keyboard launches/focus and the existing mobile controls remain available. Browsers missing IntersectionObserver fall back to static presentation.

No FPS/real-device GPU claims. Existing Phaser/Three lazy bundles remain large; this upgrade never imports them into the gallery. There is no scroll hijacking, artificial draggable library, stock video, external media request or new backend.

## Verification

- Final TypeScript + production build pass; 23/23 core unit tests pass. The final motion-enabled production bundle passes all nine direct routes and game initialization checks with no page errors or failed requests.
- Product, Mosslight and Notes regression suite passes: movement/build/save/import/export, mobile controls, notes persistence/folders/reorder/drag/exports/recovery.
- Dedicated motion browser suite passes: contextual cursor/nonblocking overlays; lazy video and real playback; hover/focus/offscreen pause; reduced motion; opt-out persistence; modal drag/exit; Notes reorder; native game canvas pointer; mobile navigation and Save-Data fallback. No page or console errors.
- Six-route UI suite at 1440/768/390 passes labels, keyboard modal, contrast (zero findings), filters/new-tab links and reduced motion.
- Home and Games visual inspectors: zero failures at desktop/tablet/phone. All 12 generated render sheets/folds were visually opened. Existing defended warnings concern gallery headline scale and launch-arrow chips. New source lint: zero failures; two defended outline warnings are cursor geometry and a real preview overlay. Active-drag dialog elevation is marked as a legitimate floating-overlay exception.
- Full recovery game evidence, including passing Surgery, Boxing, Rooftop and Drive runs and all nine production routes, remains in [RECOVERY_REPORT.md](RECOVERY_REPORT.md).

The interaction suite caught and resolved a duplicate React key between cursor/page and focus loss after dragging Quick Note. No outstanding page/console errors in the passing run. Earlier test-harness/renderer failures are retained in the recovery report rather than counted as passes.

Visual direction remains supplied **Midnight District**, following the recorded game-sleeve composition (draw seed 481755024). Final critique: design 6.5, usability 8.0, creativity 7.0, content 8.0 → 7.2 overall, with the skill's illustration-versus-photography cap. No stock photographs were added to inflate a pixel-game site's score.

## Remaining limits

Hover previews are intentionally desktop-only; phone artwork is static. Autoplay-blocked browsers keep the static poster. No newly generated full-game preview footage or simulated gameplay was fabricated. Heavy WebGL screenshot runs remain unreliable on the headless software renderer; actual production game initialization and isolated gameplay checks are separately recorded. Real low-end phone FPS and assistive-technology hardware checks remain recommended before production release.

Repository recovery still has a damaged original driving ZIP (56 complete entries salvaged), inaccessible external workspace contents and private local files intentionally excluded from Git. Read the recovery report for that scope. All backups remain preserved.
