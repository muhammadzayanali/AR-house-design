# 3D Asset Provider

## Primary strategy (this FYP)

**Generated architectural massing** in Three.js / React Three Fiber:

- **Modern / Contemporary / Luxury** → `ModernReferenceHouse` (cantilever, parapets, framed glazing, glass rail, interior silhouettes) aimed at `docs/reference/house-reference.png` as a *quality bar* (reference image is not shipped as a model).
- **Italian / Cottage / American / Traditional** → `ArchitecturalHouse` pitched/portico massing.
- UI label: **“Generated massing model”** — never presented as a photoreal scan.
- Configured via `HouseDesign.model_config` JSON; `model_type = procedural` by default.

## Authored GLB exports

Each design also has a metre-true `.glb` under `frontend/public/models/houses/` plus metadata in `frontend/lib/houses/manifest.json`.

```bash
python3 scripts/generate_house_glbs.py   # write GLBs + update manifest stats
cd frontend && npm run verify:models     # bbox vs footprint metadata
cd frontend && npm run optimize:models   # @gltf-transform meshopt (optional)
```

Conventions: metres, origin at footprint centre, y=0 ground, +Y up, facing +Z.

| Item | Detail |
|---|---|
| License | `project-generated` |
| Source | `plotline-procedural` |
| Attribution | See `/credits` |

## Licensing honesty

**No unlicensed Sketchfab/commercial house meshes are shipped.** CC0 photoreal houses matching the Modern reference are not available as drop-in assets without authoring in Blender. If you later export Blender GLBs, place them in `/public/models/houses/`, set `model_type=glb`, and update the manifest license/attribution fields.

## Viewer / AR

- Viewer: ACESFilmic tone mapping, sRGB, ContactShadows, DPR capped, mobile glass without transmission.
- AR: same `HouseRenderer` at 1:1 scale via WebXR **anchors** + `ShadowMaterial` ground catcher (`AnchoredHouse`).
- Draco decoders self-hosted at `/public/draco/gltf/`.

## Fallback

If a GLB fails to load → procedural `ArchitecturalHouse` / `ModernReferenceHouse` from `model_config` (no wireframe placeholder box).
