ROUND 1
Seen in one second: a vehicle and an open road.
Idea (one sentence): Jorata's quiet polygonal scenery fills the frame; instruments sit at the edges.
Live thing: manually steerable vehicle and optional real road-following autodrive.
Layout words by section: scene=full viewport / settings=scrolling side sheet / instruments=compact edge strip.
Scores: design 7 · usability 7 · creativity 7 · content 8 → overall 7.1
Caps applied: no placeholder assets; interactive game rather than photographic marketing page.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Coastal water was hidden behind a bank (coastal.png); smoothly lower the shoreline and place a visible lighthouse.
2. Shared page animation shortened the viewport (foundation.png); remove the transform on this route.
3. Phone keyboard hints were below 11px (mobile-fold.jpg); enlarge hints and give the title a solid contrasting surface.

ROUND 2
Seen in one second: winding scenery and the selected vehicle.
Idea (one sentence): Jorata's own asset pack makes the scenery; chrome stays around its perimeter.
Live thing: manual and automatic driving, six vehicles, three continuously streamed biomes.
Layout words by section: scene=full viewport / settings=scrolling side sheet / instruments=compact edge strip.
Scores: design 7.8 · usability 8 · creativity 7 · content 8 → overall 7.7
Caps applied: creativity capped at 7 for the established scenic-driving concept.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Loading briefly exposed an unframed camera under the terrain (desktop-fold.jpg); hide the scene until initialization completes, keeping the honest loading surface visible.
2. The inspector warns about 11–12px text: these are secondary keyboard hints, units and sublines, retained for the requested compact HUD; principal labels are 13–17px and speed is 38px.
3. The simplified supplied cockpit has a broad pillar (camera-cockpit.png); the eye is moved ahead of the seat at the authored height, preserving road visibility. Detailed interiors are outside this pack.

Inspector after fixes: zero failures at 1440, 768 and 390px. Actual loaded-scene screenshots were inspected separately in /tmp/jorata-drive-qa. The generic inspector also recorded loading states because it does not await game initialization.
