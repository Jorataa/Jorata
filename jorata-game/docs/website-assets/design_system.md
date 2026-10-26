# JORATA · Midnight District

One living pixel city, framed by quiet contemporary typography. Artwork supplies the spectacle; controls remain clear and calm. Website presentation assets only.

## Palette
|Role|Hex|Rule|
|---|---|---|
|Midnight|#101B2B|Primary background|
|Deep blue|#1C2D40|Raised surfaces|
|Slate|#314155|Decorative edges, never small text|
|Mint|#5FE1C3|Primary action and selection|
|Gold|#F4C978|World lighting and occasional secondary accent|
|White|#F3F7FF|Headings and main text|
|Mist|#AABBCB|Secondary copy|

## Typography and scale
Recommend Space Grotesk 600 for headings and Manrope 400–600 for body. Obtain current font files and licenses from their official distributions when integrating; font binaries are not bundled. Preview boards use locally available DejaVu Sans as a metric approximation. Brand SVGs use outlined DejaVu Sans Bold glyphs with custom tracking and original emblem, and require no font installation.

Desktop headline 64–80px, mobile 40–48px. Body 16–18px, metadata 14px. Line height 1.15 for headings and 1.6 for prose. Keep headings white; mint is an interaction accent, not a random colored word. Align text left. Avoid tiny spaced uppercase captions on every section.

## Composition
70% modern interface, 30% pixel identity. Use a single expansive hero with text on the left and architecture to the right. Mobile gets separately composed artwork. Game cards show unlettered art with live titles below. Never stretch raster art, or enlarge fine-pixel artwork beyond its native size. SVG controls stay smooth; do not pixelate the whole interface.

Use 8px spacing rhythm, 24px phone gutters, max content width 1280px. Control radius 8px, cards 16px, featured panels 20px. One primary action per section. Thin edges and a single small stepped corner replace chunky retro borders.

## States and accessibility
Buttons include default, hover, pressed, focus and disabled plates. CSS is preferred for adaptable surfaces, using the dimensions and colors supplied; SVG/PNG plates are visual references and reusable art. Keep text live and semantic. Mint controls use midnight text. White/mist text on midnight or deep blue is suitable for body copy; check final composited text contrast over artwork. Focus indicators need at least 3:1 contrast and cannot rely on glow alone. Target 44px touch hit areas; icons themselves are 24px.

## Motion
See motion_spec.json. A few pixels of parallax or a short response to an action is enough. Never animate the entire card grid. Disable ambient motion for reduced-motion preferences and on small phones. No flashing lights, no infinite attention-seeking assistant pulse.

## Brand
The original stepped J / open portal emblem represents entering a small world. Keep clear space of 8 units around the 32-unit emblem and half a cap-height around lockups. Use wordmark at 140px minimum, emblem at 24px minimum. favicon handles smaller sizes. Do not redraw the assistant to match the logo.
