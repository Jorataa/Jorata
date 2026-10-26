# Surgery interface and uploaded tool assets

The existing React game, engine, recipes, storage, routes and patient videos are retained. No dependencies or new artwork were added. Surgery has a scoped slate/navy palette, mint actions, amber warnings and coral critical states. The existing Manrope face remains loaded. The patient and bed keep their existing composite geometry.

## Asset inventory

Source: `../game design surgery/surgery_tools.zip`. All 50 PNGs were inspected together in a rendered contact sheet and copied byte-for-byte to `public/surgery/tools/`. Original 256 × 256 canvases and transparency remain unchanged. CSS uniformly scales the padded canvas inside an icon slot; it never stretches the art.

`src/surgery/SurgeryToolIcon.tsx` maps functional tool IDs to assets and handles unavailable files with the existing, consistently styled outline glyphs. The same component appears in inventory, selected treatment hint, application feedback, descriptions, tool encyclopedia and recipe steps. Tool IDs and engine behavior are unchanged.

| Functional tool | Uploaded image | Visual content |
| --- | --- | --- |
| Ultrasound | ultrasound.png | Sonogram display |
| Anesthetic | anesthetic.png | Anesthetic vial |
| Antiseptic | antiseptic.png | Antiseptic bottle |
| Scalpel | scalpel.png | Surgical blade |
| Stitches | suture.png | Curved needle and thread |
| Surgical Clamp | clamp.png | Ring-handled clamp |
| Surgical Sponge | gauze.png | Folded white gauze pads |
| Antibiotics | antibiotic.png | Green antibiotic vial |
| Transfusion | blood_transfusion.png | Red blood bag |
| Defibrillator | defibrillator.png | Display with connected paddles |

**Missing matching art:** Splint, Pins, Lab Kit and Fix It. These use outline fallbacks. A bandage is not a splint, and a glucose meter is not the game's infection Lab Kit.

The other 40 supplied images depict tools or supplies with no existing functional tool ID. They are preserved in the asset folder for future use; they were not assigned to unrelated tools or added as decorative inventory:

- Airway/support: oxygen_mask (oxygen mask), resuscitator (manual ventilation bag), ventilator (ventilation machine).
- Sterile supplies: gloves, surgical_drape (folded blue cloth), bandage (rolled bandage), mask, tray (metal instrument tray), sharps_bin (red disposal container), cotton_swab.
- Instruments: suction (canister/tube), bone_saw (powered saw), cautery (wired cautery pen), forceps (tweezers), retractor (metal retractor), scissors, needle_holder (ring-handled needle holder), syringe, neuro_hammer (reflex hammer), penlight.
- Monitoring/diagnosis: glucose_meter, stethoscope, blood_pressure (cuff and display), pulse_oximeter (finger sensor), x_ray (chest film), ecg_monitor (waveform display), thermometer.
- Medicines/fluids: insulin (vial), painkiller (orange vial), other_meds (bottle and tablets), anticoagulant (vial), antipyretic (vial), disinfectant (spray bottle), adrenaline (orange syringe), sedative (blue vial), normal_saline (syringe), atropine (green syringe), anti_inflammatory (vial), steroid (purple vial), iv_fluids (blue IV bag).

## Design and verification

The Design Taste app-screen workflow informed quiet surfaces, compact vitals, a dominant patient and restrained feedback. The user's explicit slate/mint palette and existing Manrope typography take precedence over the dealt ledger direction. Web Interface Guidelines informed focus visibility, image dimensions, live descriptions, touch alternatives, modal behavior and reduced motion. Existing patient animations and pause controls remain in place.

Screenshots in `artifacts/surgery-redesign/` include selection, operating room at 1440 / 768 / 390 pixels, tool guide and before captures. The uploaded images are visibly larger after accounting for their transparent canvas padding. The selection screen intentionally uses a long case list beside a shorter sticky patient preview; they represent different content rather than equal-height cards.

Checks:
- Production TypeScript/Vite build.
- Existing 11 unit tests, including 14 diseases across 100 random seeds.
- Existing browser surgery suite: all 14 case wins, loss, drag/drop, touch, persistence, guidebook, tablet/mobile overflow and navigation to Play and Notes.
- Media suite: real video playback, critical loop, pixel-identical bed across moods, case resume isolation and corrupt/blocked storage.
- Extra browser verification: all 10 mapped images load, four missing-art fallbacks, selected hint/description images, functional scan and blocked-image recovery without page errors.
- Asset byte comparison: all 50 copied PNGs match the ZIP originals.

The art for four game tools remains unavailable. No substitutes were invented. Other pre-existing workspace edits are outside this change.

## Final visual review

Seen first: Rowan in the fixed pixel-art hospital bed, framed by quiet vitals and the current objective. The operating room is the canvas; original tool sprites are the controls. Live interaction: select/click, drag/drop or touch a tool and apply it to advance the existing case. Selection=list/detail; operating=patient/objective; inventory=tray; guide=reference.

Final app-screen assessment: design 8, usability 8, creativity 7, content 8; weighted 7.8/10. The remaining limitations are the white background baked into the patient artwork, a long inventory/reference flow on phones, and four unavailable tool images. The original patient artwork was preserved as requested.

Design inspector: 0 failures. Retained warnings: the explicitly requested warm-white text triggers its cream-color heuristic; the disease list is intentionally longer than its sticky preview; mobile metadata uses 12px sublines. Source lint has 0 failures; its one shadow warning is the floating mobile action bar, an allowed overlay. The inspected title fits one line at all three widths. All screens use the loaded Manrope family.
