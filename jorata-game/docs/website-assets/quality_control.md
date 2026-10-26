# Export verification

- 113 image/vector exports decoded or parsed successfully.
- All individual files reviewed through artwork, vector and preview contact sheets. Cover subjects, text space, mobile composition and robot identity checked visually.
- Three 1536×1024 environmental plates contain genuine alpha, including fully clear pixels and near-opaque art. No checkerboard backgrounds. PNG overlays and sprite strip retain alpha.
- All 12 cover variants checked; portrait Boxing regenerated separately to preserve both athletes.
- Hero-only preview was repaired from the verified desktop composition after a truncated PNG write was detected. All final raster exports were then decoded again.
- All SVGs parse, have explicit dimensions and no external image/font dependencies or scripts. Logos are outlines.
- No identical-byte duplicate files; format variants are intentional. No empty files, gameplay assets, website code or backend files.
- Design and motion specifications supplied. Transparent plates are a separate composition from the static master; this distinction is explicit in the integration guide.
- Final ZIP CRC and entry count checked after packaging. ZIP includes previews as well as individual usable files.

Runtime website behavior was not tested: no website implementation is part of this delivery. Recommended fonts are not bundled; preview boards use available DejaVu Sans. Existing robot is visible only in previews and should be reused from the site's current asset set.
