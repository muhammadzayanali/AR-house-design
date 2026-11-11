# Decisions — result screen and massing

## Kept

- Three.js / R3F only. WebXR anchors, hit-test, measurement, and the rule-based recommender are unchanged.
- Procedural massing stays the catalog renderer. Authored GLBs remain metre-true exports, not claimed as scans.
- Desktop reflections use two Poly Haven CC0 HDRIs (Lebombo by day, Venice Sunset in the evening), downscaled to 256×128 and filtered once with PMREM. Switching Evening swaps the texture. Phones do not download the HDR. The label stays “Generated massing model”.

## Chosen beyond the brief

- **Canvas height, not view offset.** `setViewOffset` kept the top of the frame (sky and roof) and hid the facade behind the sheet. The phone canvas height is `100dvh` minus the sheet, and the camera refits when that size changes. Peek / half / full are buttons as well as a drag handle, because a drag-only control was unreliable.
- **Sheet is CSS, not a gesture library.** Three snap points (peek 128px, half 46%, full 86%) with a 44px drag handle. `prefers-reduced-motion` drops the height transition.
- **Ask / Report on the result screen** call the preview consultant for the open design. Saving still stores the project.
- **Site dressing is low-poly geometry** (lawn shape, kerb, wall, gate gap, driveway, three canopy trees). No unlicensed tree GLBs.
- **Part 3 stopped.** No Blender MCP namespace is connected. Do not install Blender from this session. To continue: install Blender 4.x, enable the Blender MCP addon, and connect that server in Cursor. Then the Modern hero can be modelled there and exported.

## Camera preview (October 2026)

- Phones without `immersive-ar` get a camera-preview pose when the stream reports `facingMode: environment` and a `deviceorientation` event arrives with a real reading. The user-agent string is not the test. iOS still needs the Enable motion button, because that permission has to be requested from a tap. The house stays at 1:1 metres and a drag that would leave the plot is refused. Walking is not tracked, so the house slides if you walk.
- WebXR session start, anchors, hit-test, measurement, and the recommender were not rewritten.
- **AlvaAR is not shipped.** It is GPLv3 (Alan Ross, github.com/alanross/AlvaAR). Tracking on empty ground was not run on a real phone over HTTPS from this session, so the WASM is not loaded. The Experimental toggle explains that and stays on camera preview. Do not vendor AlvaAR until a phone test shows the pose holds.

## Catalogue assumptions

The rupee bands on each house row (for example Italian Compact PKR 14–19 million) are catalogue assumptions typed into the seed so the planner has one labelled range. They are not a contractor quote, a bill of quantities, or a published market survey. When an answer talks about construction cost, that catalogue band is the only construction range. LDA map-approval is a separate fee illustration, not a second construction range.

## Phone demo and tunnel

The phone demo and the tunnel host are written once in [DEMO_READINESS.md](DEMO_READINESS.md).

## Result-screen frame rate (12 Nov 2026, this Mac)

Chrome on an AMD Radeon Pro 560X, Italian Family Villa, viewport 1440×900. Before the pass, device pixel ratio 2 produced a 2880×1800 buffer, about 622 draw calls a frame, and a sustained 14 fps (median frame 66 ms). The same scene at ratio 1 was about 29 fps. After the lighting pass the cap is 1.5 (buffer 2160×1350) and draw calls were about 141. Merging static meshes that share a material then brought Italian Family to 12 draws a frame. Median frame time stayed 16.7 ms. No phone was in the room.

Texture GPU estimate is uncompressed RGBA8 plus mipmaps. Eighteen maps at 1024² are 96 MB. The same set at 512² is 24 MB. Phones use the 512 px files because 96 MB is over the 40 MB phone budget. Desktop keeps 1K. The canvas textures remain the first frame and the step-down below 30 fps.

`?debug=1` shows a hidden diagnostics overlay with a Copy report button. It is not part of the normal UI.

## Not done on purpose

- Photoreal plaster scans, transmission glass on phones, or real-time shadow maps on mobile.
- Replacing every style with a unique Blender asset.
