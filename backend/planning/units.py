"""Pakistan land-unit conversions used by measurement and reports.

Constants (Punjab / standard engineering conversion used in this FYP):
  1 Marla  = 272.25 sq ft = 25.29285264 m²   (spec: ≈ 25.29 m²)
  1 Kanal  = 20 Marla
  1 Acre   = 8 Kanal = 160 Marla  (Punjab) ≈ 4,046.86 m²
  1 m²     ≈ 10.76391041671 sq ft

These are conversion constants, not learned parameters.
"""
from __future__ import annotations

# 272.25 sq ft × 0.09290304 m²/sq ft
MARLA_SQM = 25.29285264
KANAL_SQM = MARLA_SQM * 20.0  # 505.8570528
ACRE_SQM = MARLA_SQM * 160.0  # 4,046.8564224  (Punjab 8-kanal acre)
SQM_TO_SQFT = 10.76391041671


def sqm_to_sqft(area_sqm: float) -> float:
    return round(max(float(area_sqm), 0.0) * SQM_TO_SQFT, 1)


def sqm_to_units(area_sqm: float) -> dict:
    area = max(float(area_sqm), 0.0)
    marla = area / MARLA_SQM
    kanal = area / KANAL_SQM
    acre = area / ACRE_SQM
    sqft = area * SQM_TO_SQFT
    if area >= KANAL_SQM:
        display_unit = "kanal"
        display_value = kanal
    elif area >= MARLA_SQM:
        display_unit = "marla"
        display_value = marla
    else:
        display_unit = "sqm"
        display_value = area
    return {
        "sqm": round(area, 2),
        "sqft": round(sqft, 1),
        "marla": round(marla, 3),
        "kanal": round(kanal, 4),
        "acre": round(acre, 5),
        "display_unit": display_unit,
        "display_value": round(display_value, 3),
        "display_label": _label(display_unit, display_value, area),
    }


def _label(unit: str, value: float, sqm: float) -> str:
    if unit == "kanal":
        return "{:.2f} Kanal ({:.1f} m²)".format(value, sqm)
    if unit == "marla":
        return "{:.2f} Marla ({:.1f} m²)".format(value, sqm)
    return "{:.1f} m²".format(sqm)
