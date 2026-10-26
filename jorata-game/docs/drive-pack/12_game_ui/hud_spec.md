# Jorata HUD

The runnable implementation is `15_preview_scenes/viewer/`; the icons, tokens, portal, and styles in this directory are reusable production inputs.

- Scene occupies the full viewport. Header: brand left, fullscreen and Studio right. Leave the center clear.
- Bottom left: environment, lighting/weather, and optional orbit hint. Bottom right: 64px lightweight speed, KM/H label and a 44px control row.
- Studio: one 345px panel, 24px padding, 12px field gaps, restrained 18px panel radius. It scrolls at short viewport heights and closes with Escape, returning focus to its opener.
- Under 680px: 18px outer gutters, 48px speed, 20px location, full-width settings inset 14px. Text buttons collapse to accessible icon buttons.
- All actions have focus, hover, pressed, selected or disabled states. Reduced motion disables decorative loading and entrance animations.
- Start scene: actual loading overlay. Missing resources: explicit error toast. No invented progress percentages. Music begins only after user chooses local audio and presses play; no audio track is supplied.
- Optional assistant: import `AssistantPortal.tsx`, provide the existing robot PNG and real callback. `createPortal(..., document.body)` and `position:fixed` anchor it to the viewport. Pass `avoidControls` when the lower-right HUD is occupied. It has collapse/expand controls; do not bake it into the 3D world. A portal under a transformed ancestor would compromise viewport positioning, hence the body target.

Speed in the asset viewer is **0** while stationary and **60 km/h** during the finite 16.67 m/s preview loop. The viewer is not a full driving game or an AI backend.
