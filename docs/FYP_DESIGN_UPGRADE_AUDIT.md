# FYP Design Upgrade Audit

**Date:** 2026-09-21  
**Scope:** Architectural style selection + procedural Three.js catalog + feasibility + AI grounding

## 1. Current implementation

Working pipeline: auth → AR/manual measure → Marla/Kanal/Acre → single auto `recommend_house(plot)` → placeholder GLB → save → HF/template report.

## 2. Current 3D architecture

- `HouseModel` loads `glb_url` via `useGLTF`
- Assets: procedural massing GLBs from `scripts/generate_placeholder_houses.py` (cottage / modern / italian)
- Viewer: basic OrbitControls + lights
- No style-parameterized R3F house graph

## 3. Current HouseDesign schema

Thin: name, style, glb_url, min/max plot, beds/baths/floors, parking bool, cost, description, active.

Missing: footprint, room program, model_type/config, thumbnails, license, scale metadata.

## 4. Recommendation logic

Inclusive plot-range match → closest midpoint. No style filter. Auto-picks one house.

## 5. AI

`project_facts` → HF chat. No feasibility JSON. Timeout + template fallback exists.

## 6. AR

WebXR hit-test → place `recommendation.house.glb_url`. Manual OrbitControls fallback.

## 7. Missing (this upgrade)

Style selection UI; multi-design catalog; procedural ArchitecturalHouse; feasibility engine; richer AI JSON; model_type dual path (procedural | glb).

## 8–9. Third-party assets

Default: **procedural Three.js** (no live Sketchfab). Optional `model_type=glb` later. See `docs/3D_ASSET_PROVIDER.md`.

## 10. Proposed architecture

```text
Measure → units → Style cards → GET houses?style&plot_area
→ Select design → Feasibility + room program
→ ArchitecturalHouse | useGLTF → Viewer / AR
→ Structured JSON → HF report/Q&A → Save
```

## 11–14. Changes

DB migration enriching HouseDesign + Project feasibility snapshot fields; filter/feasibility APIs; R3F components; ARExperience phases; AI context builder; tests.

## 15. Risks

Procedural ≠ photoreal CGI; mobile poly budget; HF latency. Mitigate with optimized geometry, lazy load, timeouts.

## 16. Implementation order

Model → seed → feasibility APIs → R3F library → style UI → catalog → AI → AR → tests.
