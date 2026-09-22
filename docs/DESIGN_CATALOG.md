# Design Catalog

## Styles

Modern, Italian Villa, American, Cottage / Hut, Contemporary, Traditional, Luxury Villa.

## Designs

Seeded via `python manage.py seed_houses` — 15 active procedural designs with plot ranges, footprints, room programmes, and `model_config` JSON.

## Filtering

`GET /api/designs/match/?style=Italian%20Villa&plot_area=180`

Returns `exact` designs in range, or `nearby` with an honest no-match message.

## Model types

- `procedural` — Three.js `ArchitecturalHouse` from `model_config`
- `glb` — optional local `glb_url` / `model_url` without rewriting the app
