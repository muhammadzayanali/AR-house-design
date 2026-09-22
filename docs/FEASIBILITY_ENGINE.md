# Feasibility Engine

Deterministic Python in `planning/feasibility.py`.

## Inputs

Plot area (required), optional L×W, selected `HouseDesign` footprint.

## Outputs

- `building_footprint_sqm`
- `remaining_area_sqm`
- `ground_coverage_percent`
- `status`: suitable_preliminary | tight | oversized | dimension_conflict
- rectangle fit when L×W known

## Space estimate (pre-selection)

Area bands → preliminary bedroom/bath ranges. Superseded by design room programme after selection.

## Not claimed

No bylaws, no structural design, no legal approval.
