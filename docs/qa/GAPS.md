# Remaining gaps

Checked against `docs/reference/house-reference.png`, the shots in `docs/qa/massing/`, and a Chrome profile on this Mac (AMD Radeon Pro 560X) on 12 Nov 2026. No phone was used.

## Still different from the reference

1. The reference is a cutaway product shot. Ours is a closed massing model. Furniture is a few blocks behind the glass, not a readable dining set.
2. Evening light is a warm tint plus a small interior point light, not a lit room.
3. Plaster, roof, stone, timber, paving, and grass can use Poly Haven CC0 WebP maps after the first frame. They are still tiled on boxes. The first frame is the canvas texture.
4. Trees are low-poly icosahedra, not scanned trees. The reference has no trees.
5. The cantilever is a slab, not the thick floating band in the reference.
6. Mullions are a regular grid of boxes.
7. The downpipe, door, and AC units are still simple boxes.
8. The camera is a high 3/4 orbit.
9. The label is still “Generated massing model”.

## Frame rate on this Mac, not a phone

Italian Family Villa, 1440×900, Chrome:

- Before: device pixel ratio 2, buffer 2880×1800, about 622 draws per frame, sustained 14 fps (median 66 ms). At ratio 1 the same build was about 29 fps. `gl.info` reported 6038 triangles because the shadow map and the every-frame contact-shadow pass were drawing the scene again.
- After the lighting pass: ratio capped at 1.5, buffer 2160×1350, about 141 draws, mesh pass about 2194 triangles, steady 60 fps after the HDR filter. Evening toggle worst frame 17 ms.
- After merging static meshes that share a material (12 Nov 2026, same machine, `?debug=1`): 12 draws, 2194 triangles, 12 geometries, desktop texture tier `webp-1k`, live texture estimate 49.8 MB. Median frame stayed 16.7 ms. The 5 s overlay sample read about 57 fps average with a 4 fps minimum from one hitch. Phones request the 512 px maps (about 24 MB if all 18 are unique) because the 1K set is about 96 MB, over the 40 MB phone budget.

Phones load the WebP maps and skip the HDR. That path was not timed on a handset. If the monitor stays under 30 fps it drops the pixel ratio and then the WebP maps.

## What this session did not run

- WebXR immersive-ar was not available. Anchors and hit-test were not edited.
- Camera-preview tap-to-place needs a rear camera and a real `deviceorientation` event. This Mac has neither, so that path was not exercised on a device. The L-shaped plot check is the unit test in `scripts/test_plot_clamp.mjs`.
- The Cloudflare hostname in `netlify.toml` did not resolve. This machine was not on mobile data, and the Netlify site name is not stored in the repo, so the public phone path was not completed.
- With `DJANGO_DEBUG=false` on 127.0.0.1:8001, health, style match, and the cost question succeeded, and a foreign `Origin` did not receive `access-control-allow-origin`.

## Part 3

Blender MCP is not connected. No Blender hero model was exported.
