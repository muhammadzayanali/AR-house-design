"""Deterministic plot feasibility + preliminary space estimation.

No LLM involvement — these values are the source of truth for reports.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


SPACE_BANDS = [
    {
        "min": 0,
        "max": 100,
        "bedrooms": "1–2",
        "bathrooms": "1–2",
        "living": "1",
        "dining": "compact",
        "kitchen": "1",
        "parking": "0–1",
        "notes": "Compact programme for small plots.",
    },
    {
        "min": 100,
        "max": 150,
        "bedrooms": "2–3",
        "bathrooms": "2",
        "living": "1",
        "dining": "1",
        "kitchen": "1",
        "parking": "0–1",
        "notes": "Small family programme.",
    },
    {
        "min": 150,
        "max": 220,
        "bedrooms": "3–4",
        "bathrooms": "2–3",
        "living": "1",
        "family": "0–1",
        "dining": "1",
        "kitchen": "1",
        "parking": "1",
        "notes": "Typical mid-size family home.",
    },
    {
        "min": 220,
        "max": 350,
        "bedrooms": "4–5",
        "bathrooms": "3–4",
        "living": "1",
        "family": "1",
        "dining": "1",
        "kitchen": "1",
        "parking": "1–2",
        "notes": "Larger family / villa programme.",
    },
    {
        "min": 350,
        "max": 10_000,
        "bedrooms": "5+",
        "bathrooms": "4+",
        "living": "1–2",
        "family": "1",
        "dining": "1",
        "kitchen": "1",
        "parking": "2+",
        "notes": "Large villa / multi-wing programme.",
    },
]


def preliminary_space_estimate(plot_area_sqm: float) -> Dict[str, Any]:
    size = float(plot_area_sqm)
    band = next((b for b in SPACE_BANDS if b["min"] <= size < b["max"]), SPACE_BANDS[-1])
    return {
        "plot_area_sqm": round(size, 2),
        "estimate": {k: v for k, v in band.items() if k not in ("min", "max")},
        "disclaimer": (
            "Preliminary space estimate from configured area bands only. "
            "After you select a catalog design, that design's room programme is authoritative."
        ),
    }


def compute_feasibility(
    plot_area_sqm: float,
    house,
    plot_length_m: Optional[float] = None,
    plot_width_m: Optional[float] = None,
) -> Dict[str, Any]:
    plot = float(plot_area_sqm)
    footprint = float(getattr(house, "building_footprint_sqm", 0) or 0)
    if footprint <= 0:
        w = float(getattr(house, "building_width_m", 0) or 0)
        d = float(getattr(house, "building_depth_m", 0) or 0)
        footprint = w * d
    remaining = plot - footprint
    coverage = (footprint / plot * 100.0) if plot > 0 else 0.0

    width_ok = None
    depth_ok = None
    bw = float(getattr(house, "building_width_m", 0) or 0)
    bd = float(getattr(house, "building_depth_m", 0) or 0)
    if plot_length_m and plot_width_m and bw and bd:
        # Orient house either way on the plot rectangle
        a = float(plot_length_m)
        b = float(plot_width_m)
        width_ok = (bw <= a and bd <= b) or (bw <= b and bd <= a)
        depth_ok = width_ok

    if footprint > plot:
        status = "oversized"
        note = (
            "Building footprint exceeds measured plot area. "
            "Treat as visualization only — not a buildable fit."
        )
    elif coverage > 70:
        status = "tight"
        note = (
            "Ground coverage is high for preliminary planning. "
            "Open space may feel constrained."
        )
    elif width_ok is False:
        status = "dimension_conflict"
        note = (
            "House plan dimensions may not fit the measured plot rectangle "
            "without rotation or redesign."
        )
    else:
        status = "suitable_preliminary"
        note = "Footprint fits within plot area for preliminary visualization."

    return {
        "plot_area_sqm": round(plot, 2),
        "building_footprint_sqm": round(footprint, 2),
        "remaining_area_sqm": round(remaining, 2),
        "ground_coverage_percent": round(coverage, 1),
        "building_width_m": bw,
        "building_depth_m": bd,
        "plot_length_m": plot_length_m,
        "plot_width_m": plot_width_m,
        "fits_rectangle": width_ok,
        "status": status,
        "note": note,
        "disclaimer": (
            "Preliminary planning calculation only. Not a bylaw check, "
            "structural design, or municipal approval."
        ),
    }


def design_room_program(house) -> Dict[str, Any]:
    return {
        "bedrooms": house.bedrooms,
        "bathrooms": house.bathrooms,
        "living_rooms": house.living_rooms,
        "family_rooms": house.family_rooms,
        "dining_rooms": house.dining_rooms,
        "kitchens": house.kitchens,
        "parking_spaces": house.parking_spaces,
        "balconies": house.balconies,
        "terraces": house.terraces,
        "garage": house.garage,
        "pool": house.pool,
        "garden": house.garden,
        "floors": house.floors,
    }


def filter_designs(
    queryset,
    *,
    style: Optional[str] = None,
    plot_area: Optional[float] = None,
    exact_only: bool = True,
) -> Dict[str, Any]:
    qs = queryset.filter(active=True)
    if style:
        style_key = style.strip()
        if style_key.lower() == "villa":
            # Aggregate Italian Villa + Luxury Villa (and any *Villa styles)
            qs = qs.filter(style__icontains="villa")
        else:
            qs = qs.filter(style__iexact=style_key)

    exact: List = []
    nearby: List = []
    if plot_area is None:
        return {"exact": list(qs), "nearby": [], "match_kind": "all"}

    size = float(plot_area)
    for house in qs:
        lo = house.effective_min_plot
        hi = house.effective_max_plot
        if lo <= size <= hi:
            exact.append(house)
        else:
            mid = (lo + hi) / 2.0
            nearby.append((abs(mid - size), house))

    nearby_sorted = [h for _, h in sorted(nearby, key=lambda t: t[0])[:6]]
    if exact:
        return {"exact": exact, "nearby": nearby_sorted, "match_kind": "exact"}
    return {
        "exact": [],
        "nearby": nearby_sorted,
        "match_kind": "nearby",
    }
