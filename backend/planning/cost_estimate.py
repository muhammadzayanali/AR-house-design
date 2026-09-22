"""Lahore reference construction-cost estimator (deterministic).

Rates derived from Zameen construction calculator benchmarks (Sept 2026).
Labeled as Lahore reference only — not a nationwide or contractor quotation.

Cost uses covered/built area × interpolated PKR/sq ft rate from plot Marla band.
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

from .units import MARLA_SQM, sqm_to_sqft


# (marla_anchor, published_total_pkr, published_rate_pkr_per_sqft)
# 1 Kanal = 20 Marla
LAHORE_BENCHMARKS: List[Tuple[float, int, int]] = [
    (3.0, 6_550_000, 5391),
    (4.0, 8_147_000, 5029),
    (5.0, 9_492_000, 4688),
    (6.0, 10_700_000, 4663),
    (7.0, 12_000_000, 4478),
    (8.0, 13_900_000, 4555),
    (10.0, 15_300_000, 4523),
    (20.0, 28_200_000, 4471),
]

COST_DISCLAIMER = (
    "Construction cost is a preliminary Lahore reference estimate and may vary "
    "with market prices, materials, labour, covered area and design complexity. "
    "Not a contractor quotation or BOQ."
)


def _interpolate_rate(marla: float) -> float:
    points = LAHORE_BENCHMARKS
    if marla <= points[0][0]:
        return float(points[0][2])
    if marla >= points[-1][0]:
        return float(points[-1][2])
    for i in range(len(points) - 1):
        m0, _, r0 = points[i]
        m1, _, r1 = points[i + 1]
        if m0 <= marla <= m1:
            t = (marla - m0) / (m1 - m0) if m1 != m0 else 0.0
            return float(r0 + t * (r1 - r0))
    return float(points[-1][2])


def estimate_construction_cost(
    *,
    covered_area_m2: float,
    plot_area_m2: float,
    quality: str = "standard",
    floors: int = 1,
) -> Dict[str, Any]:
    """Estimate using approximate gross floor area = footprint × floors.

    ``covered_area_m2`` is the ground footprint. Construction cost is applied to
    footprint × floors (preliminary GFA), not to raw plot area.
    """
    covered = max(float(covered_area_m2), 0.0)
    plot = max(float(plot_area_m2), 0.0)
    storeys = max(int(floors or 1), 1)
    built_m2 = covered * storeys
    covered_sqft = sqm_to_sqft(covered)
    built_sqft = sqm_to_sqft(built_m2)
    marla = plot / MARLA_SQM if plot > 0 else 0.0
    base_rate = _interpolate_rate(marla)

    quality_key = (quality or "standard").lower().strip()
    quality_mult = {"standard": 1.0, "premium": 1.18, "luxury": 1.35}.get(
        quality_key, 1.0
    )
    rate = base_rate * quality_mult
    mid = built_sqft * rate
    # Transparent range (±12%) — avoid fake precision
    low = int(round(mid * 0.88, -3))
    high = int(round(mid * 1.12, -3))
    if low < 0:
        low = 0
    if high < low:
        high = low

    return {
        "currency": "PKR",
        "quality": quality_key if quality_key in ("standard", "premium", "luxury") else "standard",
        "min": low,
        "max": high,
        "mid": int(round(mid, -3)),
        "covered_area_m2": round(covered, 2),
        "covered_area_sqft": covered_sqft,
        "built_area_m2": round(built_m2, 2),
        "built_area_sqft": built_sqft,
        "floors": storeys,
        "reference_rate_pkr_per_sqft": round(rate, 1),
        "plot_marla_for_rate": round(marla, 3),
        "source": "Lahore reference benchmark",
        "source_detail": (
            "Interpolated PKR/sq ft from Zameen Lahore construction calculator "
            "anchors (3–10 Marla, 1 Kanal), Sept 2026. Applied to approximate "
            "gross floor area (footprint × floors), not raw plot area."
        ),
        "is_estimate": True,
        "estimate_type": "preliminary",
        "disclaimer": COST_DISCLAIMER,
    }
