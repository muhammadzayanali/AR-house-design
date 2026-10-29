# Decisions — result screen and massing

## Kept

- Three.js / R3F only. WebXR anchors, hit-test, measurement, and the rule-based recommender are unchanged.
- Procedural massing stays the catalog renderer. Authored GLBs remain metre-true exports, not claimed as scans.
- drei `Environment` preset (`city`, blurred background) instead of a downloaded HDRI. A 1k CC0 HDR was not vendored in this pass (network + license file size). Preset is a library asset, not a photoreal claim.

## Chosen beyond the brief

- **Canvas height, not view offset.** `setViewOffset` kept the top of the frame (sky and roof) and hid the facade behind the sheet. The phone canvas height is `100dvh` minus the sheet, and the camera refits when that size changes. Peek / half / full are buttons as well as a drag handle, because a drag-only control was unreliable.
- **Sheet is CSS, not a gesture library.** Three snap points (peek 128px, half 46%, full 86%) with a 44px drag handle. `prefers-reduced-motion` drops the height transition.
- **Ask / Report on the result screen** call the preview consultant for the open design. Saving still stores the project.
- **Site dressing is low-poly geometry** (lawn shape, kerb, wall, gate gap, driveway, three canopy trees). No unlicensed tree GLBs.
- **Part 3 stopped.** No Blender MCP namespace is connected. Do not install Blender from this session. To continue: install Blender 4.x, enable the Blender MCP addon, and connect that server in Cursor. Then the Modern hero can be modelled there and exported.

## Camera preview (October 2026)

- Phones without `immersive-ar` get a camera-preview pose: rear camera plus device orientation. The house stays at 1:1 metres. Walking is not tracked, so the house slides if you walk.
- WebXR session start, anchors, hit-test, measurement, and the recommender were not rewritten.
- **AlvaAR is not shipped.** It is GPLv3 (Alan Ross, github.com/alanross/AlvaAR). Tracking on empty ground was not run on a real phone over HTTPS from this session, so the WASM is not loaded. The Experimental toggle explains that and stays on camera preview. Do not vendor AlvaAR until a phone test shows the pose holds.

## Not done on purpose

- Photoreal plaster scans, transmission glass on phones, or real-time shadow maps on mobile.
- Replacing every style with a unique Blender asset.
