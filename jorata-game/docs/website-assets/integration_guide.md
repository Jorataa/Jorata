# Codex integration guide

Assets only. Do not modify gameplay, game content, routes, API behavior, AI logic or backend to integrate this pack. Existing features and names are authoritative; text on preview boards is sample presentation copy, not a product specification.

## Start here
1. Read design_system.md and tokens.json. Inspect previews/desktop_homepage.png and previews/mobile_homepage.png.
2. Use branding/jorata_logo_dark.svg over navy, jorata_logo_light.svg over light surfaces. Compact identity is jorata_emblem.svg; favicon assets include SVG, PNG and ICO. Logo paths are already outlined.
3. Put game art into existing cards only. Never load promotional art as character sprites, medical tools, playable scenery or a game canvas background.

## Exact placement map
|Existing area|Assets|Sizing / composition|
|---|---|---|
|Desktop home hero|hero/hero_bg_main.webp + overlays/text_scrim_desktop.svg|1536×1024 source. Text x=5–43%, y=17–53%; heading before scenery in reading order. Art may sit behind copy or in existing featured area.|
|Phone home hero|hero/mobile/hero_bg_mobile.webp + overlays/text_scrim_mobile.svg|1024×1536 source, top 40% text-safe; dedicated composition. Use a picture source below your actual layout breakpoint.|
|Optional parallax alternative|hero/layers/hero_sky_base.webp, hero_bg_far.png, hero_bg_mid.png, hero_bg_foreground.png|Every plate 1536×1024; aligned bottom-center with identical canvas scale. This is a separately authored layered scene, NOT an exact reconstruction of hero_bg_main.webp. Never stack the static hero behind these layers. Reference hero_parallax_composite.webp.|
|Existing game cards|game-covers/game_*_card.webp|768×512; preserve 3:2 crop. Keep titles live below artwork.|
|Featured promo|game_*_featured.webp or game_*_landscape.webp|Featured 1536×1024; landscape 1200×675. Use only in an existing promotional placement.|
|Tall promotional cards|game_*_mobile.webp|600×800; Boxing has independent portrait art to retain both faces. Normal phone library can still use landscape cards.|
|Quiet page backgrounds|backgrounds/bg_homepage.webp, bg_discovery.webp, bg_library.webp, bg_notes.webp, bg_footer.webp, bg_section.webp|Subtle; do not repeat full pictures as texture tiles. Only texture_pixel_dust.svg is seamless.|
|Presentation surfaces|ui-components/*.svg|Frames, surfaces, button states, badges, search treatment, separators. Keep labels and controls as live semantic elements. Recreate responsive surfaces in CSS from tokens when appropriate; fixed background plates must not dictate content height.|
|Existing assistant widget|assistant/assistant_widget_frame.svg or .png; assistant_hover.svg; assistant_panel_background.svg or .png|Keep the existing robot asset, unchanged, above shell. Existing robot is shown on preview boards only and is intentionally not supplied as a replacement.|
|Assistant speech / notification|assistant/speech_bubble*.svg, notification_indicator.svg|No baked text or fabricated AI state. Only display a notification for actual unread content.|
|Icons|icons/icon_*.svg|24×24, 2px stroke. Inline SVG inherits currentColor; CSS mask is a good alternative. An SVG loaded as an external img does not inherit surrounding CSS color.|
|Optional decoration|decorations/*.svg, overlays/*.svg|Use sparsely. Window-light motif is decorative, not registered to generated windows. Do not randomly scatter it over architecture.|
|Motion resources|motion/ambient_spark_strip.png, dock_glow_*.svg, motion_spec.json|Sprite strip is 256×64: four 64×64 frames. No animation runtime included.|

## Responsive and performance rules
Keep the assistant pinned to the VIEWPORT bottom-right, outside transformed or scrolling containers. Allow about 24px desktop clearance and 16px plus safe-area inset on mobile. Preserve access to existing controls; reduce dock size or collapse the panel when needed. Panel can be at most 360px wide, bounded by available viewport width. Preview boards depict static placement only.

Choose ONE hero strategy: static desktop/mobile art (recommended) or independent layered parallax. Do not load both. Preload only the chosen above-the-fold image. Lazy-load below-the-fold covers. Set image width, height and aspect ratio to prevent layout shift. Card assets are already optimized WebP. Keep original alpha on transparent PNG layers. Do not use nearest-neighbor enlargement on the whole website; native vector controls stay smooth, and detailed pixel art should not be upscaled past its natural resolution.

Use max 10px parallax travel and 3% shared overscan; bottom anchoring prevents edge gaps. Disable parallax on phone and under reduced motion. Use static frame for reduced motion and pause ambient loops offscreen. Never translate individual layers at unrelated scales.

Text contrast must be tested against the final composited hero, not just palette tokens. Keep mint-button text midnight. White focus rings remain visible on dark surfaces. All icon-only actions need names; decorations need empty alt text. No image can replace a button's semantics or label.

## Scope and limitations
These are production-exported static assets and motion-ready resources. No website code, JavaScript, gameplay files or functional AI components are included. Browser behavior, responsive breakpoints, focus handling and actual runtime performance remain integration checks for Codex. Preview font metrics approximate the recommended families; font binaries are not included.
