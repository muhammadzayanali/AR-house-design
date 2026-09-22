# 3D Asset Provider

## Primary strategy (this FYP)

**Procedural architectural generator** built with Three.js / React Three Fiber / drei.

- No live third-party download API at runtime
- Configured via `HouseDesign.model_config` JSON
- `model_type = procedural` (default)

## Optional GLB path

`model_type = glb` + `glb_url` / `model_url` pointing at local `/models/*.glb`.

Existing massing files remain available as optional GLB entries but are **not** the primary catalog presentation.

## Sketchfab / external marketplaces

| Item | Detail |
|---|---|
| Provider | Sketchfab Download API |
| Auth | User OAuth required for downloads |
| Formats | GLB / glTF ZIP |
| Runtime | **Not used** — would require per-user auth |
| Future | Admin one-time import into `frontend/public/models/` with license fields |

## Licensing fields on HouseDesign

`source_provider`, `source_model_id`, `source_license`, `source_attribution`, `commercial_use_allowed`, `attribution_required`.

Procedural designs: `source_provider=plotline-procedural`, `source_license=project-generated`.

## Fallback

If GLB fails to load → wireframe error boundary → optional procedural rebuild from `model_config`.
