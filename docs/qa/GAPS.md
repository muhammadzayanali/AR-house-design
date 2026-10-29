# Remaining gaps after the visual loop

Compared `docs/reference/house-reference.png` with `docs/qa/side-by-side.png` (desktop evening crop). Screenshots were opened and read, not assumed.

## Still different from the reference

1. The reference is a cutaway product shot. Ours is a closed massing model on a plot. You cannot see dining chairs, a sofa, or a bed through the glass.
2. Window glow is a warm tint on the panes, not a lit interior volume.
3. Materials are flat colours (plaster, grass, concrete). No plaster grain, timber photo, or stone map.
4. Trees are cones. The reference has no trees; our site trees are diagrammatic.
5. The cantilever reads as a balcony slab, not the thick floating concrete band in the reference.
6. Mullions are a regular grid. The reference has floor-to-ceiling sliding panels with almost no horizontal bars.
7. The downpipe, door, and AC units are simple boxes. The reference downpipe is a thin metal tube on the facade.
8. Camera is a high 3/4 orbit. The reference is closer to a straight elevation.
9. Lawn is a solid green shape, not a photographed grass texture.
10. This is still labeled “Generated massing model”. It is not a photoreal asset.

## Measured in Playwright (headless Chromium, not a phone)

- CPU throttle 4×, viewport 390×844: about 60 fps over 2 seconds of `requestAnimationFrame`, first result paint about 3.7 s after opening `/ar` and walking the manual flow.
- Console errors on that run: none.
- WebXR immersive-ar was not available in this browser (`no-ar`). Anchor and hit-test code was not edited. 1:1 AR placement was not re-run on a device.

## Part 3

Blender MCP is not connected. No Blender hero model was exported.
