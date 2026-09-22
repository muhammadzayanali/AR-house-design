# Design Catalog

## Styles (8 — style picker)

From `GET /api/styles/` (`StyleCatalogView`):

1. Modern  
2. Italian Villa  
3. American  
4. Cottage / Hut  
5. Contemporary  
6. Traditional  
7. Villa *(aggregates catalog rows whose style contains “villa”, e.g. Italian Villa + Luxury Villa)*  
8. Luxury Villa  

Seed command `STYLES` keys list the distinct `HouseDesign.style` values used on rows (7 named styles); the eighth picker card is the Villa aggregate filter above.

## Designs

Seeded via `python manage.py seed_houses` — active procedural designs with plot ranges, footprints, room programmes, and `model_config` JSON.

## Filtering

`GET /api/designs/match/?style=Italian%20Villa&plot_area=180`

Returns `exact` designs in range, or `nearby` with an honest no-match message. Matching is **deterministic** (range lookup + midpoint distance), not ML.

## Model types

- `procedural` — Three.js `ArchitecturalHouse` / shared `HouseRenderer` from `model_config`
- `glb` — optional local `glb_url` / `model_url` without rewriting the app
