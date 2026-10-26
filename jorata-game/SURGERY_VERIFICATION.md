# Surgery Simulator MVP

Open **Games → Surgery Simulator**, or `/games/surgery`. The Vite dev server runs on port 3107. No login, database, network API, or new dependencies are required.

## Delivered

- 14 fully playable named conditions across all nine body categories; all available from the beginning.
- 14 tools, patient vitals, correct and incorrect applications, seeded turn-based complications, skill slips, emergency recovery, wins and losses.
- Searchable disease selection and guidebook. Actual treatment sequences and guide recipes both use `src/surgery/data.ts`.
- Desktop selection/application and native drag-and-drop; touch selection/application; native keyboard controls.
- Local skill 0–100, total recoveries, success rate, recent outcomes and best tool-turn score per disease. Storage key: `jorata.surgery.progress.v1`.
- Lazy game route inside the existing React app, Games library entry, production route rewrites. Existing Mosslight, Notes and Settings remain intact.

## Original media

All four MP4s were visually inspected at multiple timestamps and copied unchanged from `../game design surgery`. No patient artwork was generated.

| State | Original clip | Playback |
| --- | --- | --- |
| Healthy / asleep | `surgery_patient_01_healthy.mp4` | Loop |
| Pain | `surgery_patient_02_pain.mp4` | Loop; normalized from its square source |
| Anxiety | `surgery_patient_09_fear.mp4` | Loop |
| Critical | `surgery_patient_03_dying_to_dead.mp4` | Only 1.35–2.5 seconds; avoids premature death |
| Death | `surgery_patient_03_dying_to_dead.mp4` | 2.8 seconds through the final pose |

The Pain clip has a different camera/bed composition. A fixed original bed frame and a masked reaction area keep the bed and patient position invariant across all moods. Static PNG frames extracted from these same videos provide fallbacks and reduced-motion poses. Videos are muted and inline. Settings and OS reduced-motion preferences pause playback. Patient rendering is separate from the surgery engine.

## Verification

- `npm run build`: TypeScript and production bundle pass.
- `npm test`: 11 tests pass, including all 14 diseases at skill zero across 100 seeds each (1,400 complete simulated surgeries).
- Each generated guide recipe independently completes its disease when random complications are disabled.
- Engine coverage includes all five complication types, rescue/ignored critical pulse, invalid tools, skill slips, terminal states, progression, deduplication, and the skill cap.
- `node --import tsx tests/surgery.browser.ts`: all 14 diseases won through actual browser controls; failure outcome; native drag/drop; mobile touch; guidebook; save/reload; 1440/768/390 layouts; original Mosslight and Notes entry points. No page errors.
- `node --import tsx tests/surgery.media.browser.ts`: actual video playback, bounded critical loop, pixel-identical bed across moods, unfinished-case isolation, and corrupt/blocked storage all pass.
- `npm run test:browser`: existing product, Mosslight and Notes regression suites pass, including world import/export, movement, building, quick-note pause/resume, note editing, local saves, mobile controls and settings.
- Source design lint: 0 failures and 0 warnings. Responsive design inspector: 0 failures; 2 warnings for compact metadata and the intentionally longer disease list beside its sticky preview.
- `git diff --check`: clean.

The current checkout has no chat implementation. Its existing product regression explicitly checks that chat UI is absent. No chat code was added, removed or altered by this work.

## Design review

Direction: **True-black flat**, seed **1866100148**, adapted to existing Jorata sage/charcoal surfaces, Manrope type and cream actions. No redraws. The shell and existing branding were retained.

ROUND 2

Seen in one second: the pixel patient and named disease list.

Idea: Jorata’s supplied pixel patient becomes the fixed focus of a turn-based treatment workspace.

Live thing: apply a tool, see its effect, respond to a complication and recover the patient.

Layout words by section: selection=master/detail; surgery=patient/monitor/tool tray; guide=search/disclosure; progress=figures/history.

Scores: design 7 · usability 7 · creativity 7 · content 8 → overall 7.1.

Remaining limits: the full tool tray requires vertical scrolling on small screens; the companion preview deliberately ends before the full disease list. The brand palette and compact secondary labels are retained. All characters and recipes are fictional game content. No found imagery or invented proof metrics are used.

Reference reviewed for the disease-based selection and 0–100 surgery skill concept: [Growtopia Guide and Simulator](https://growtopiabestguides.blogspot.com/). Tool effects, recipes and balancing are Jorata’s fictional game rules, not real medical guidance.
