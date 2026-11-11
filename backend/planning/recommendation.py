"""Deterministic house recommendation — not a trained ML model.

Input:  measured plot area in square metres
Process: inclusive range match against HouseDesign.recommended_min_plot /
         recommended_max_plot, then pick the design whose range midpoint is
         closest to the measured size (stable, explainable tie-break).
Output: HouseDesign row + a reason string you can read in a viva.

If the plot falls outside every catalog range, the nearest design is still
returned and the reason states that it is an extrapolation.
"""
from __future__ import annotations

from typing import Optional, Tuple

from .models import HouseDesign
from .units import sqm_to_units


def _coverage(house: HouseDesign, size: float) -> float:
    if size <= 0:
        return 1.0
    footprint = float(getattr(house, "building_footprint_sqm", 0) or 0)
    if footprint <= 0:
        width = float(getattr(house, "building_width_m", 0) or 0)
        depth = float(getattr(house, "building_depth_m", 0) or 0)
        footprint = width * depth
    if footprint <= 0:
        return 1.0
    return footprint / size


def _price(house: HouseDesign) -> float:
    listed = float(getattr(house, "estimated_cost_pkr", 0) or 0)
    if listed > 0:
        return listed
    return float(getattr(house, "estimated_cost_min", 0) or 0)


def _pick_among(houses: list, size: float) -> Tuple[HouseDesign, list]:
    """Closest midpoint. Ties: lower ground coverage, then lower catalogue price."""
    best_dist = min(_midpoint_distance(h, size) for h in houses)
    tied = [h for h in houses if abs(_midpoint_distance(h, size) - best_dist) < 1e-6]
    tied.sort(key=lambda h: (_coverage(h, size), _price(h), h.name))
    chosen = tied[0]
    also = [h for h in tied[1:]]
    return chosen, also


def recommend_house(land_size_sqm: float) -> Tuple[Optional[HouseDesign], str]:
    size = float(land_size_sqm)
    units = sqm_to_units(size)
    catalog = list(
        HouseDesign.objects.filter(active=True).order_by("recommended_min_plot")
    )
    if not catalog:
        return None, "The house catalog is empty. Run: python manage.py seed_houses"

    in_range = [
        house
        for house in catalog
        if house.recommended_min_plot <= size <= house.recommended_max_plot
    ]

    if in_range:
        chosen, also = _pick_among(in_range, size)
        reason = (
            "Plot area {label} falls inside the published range for "
            "'{name}' ({style}): {lo:.0f}–{hi:.0f} m². "
            "This match is a lookup against the HouseDesign table, not a "
            "machine-learning prediction. The design has {beds} bedrooms, "
            "{floors} floor(s), and parking={parking}."
        ).format(
            label=units["display_label"],
            name=chosen.name,
            style=chosen.style,
            lo=chosen.recommended_min_plot,
            hi=chosen.recommended_max_plot,
            beds=chosen.bedrooms,
            floors=chosen.floors,
            parking="yes" if chosen.parking else "no",
        )
        if also:
            names = ", ".join(h.name for h in also)
            reason += " Also fits: {0}.".format(names)
        return chosen, reason

    chosen = min(catalog, key=lambda h: _midpoint_distance(h, size))
    reason = (
        "Plot area {label} is outside every catalog range. "
        "The nearest published design is '{name}' ({style}), "
        "intended for {lo:.0f}–{hi:.0f} m². Treat this as a closest-fit "
        "suggestion, not a guaranteed planning approval."
    ).format(
        label=units["display_label"],
        name=chosen.name,
        style=chosen.style,
        lo=chosen.recommended_min_plot,
        hi=chosen.recommended_max_plot,
    )
    return chosen, reason


def _midpoint_distance(house: HouseDesign, size: float) -> float:
    mid = (house.recommended_min_plot + house.recommended_max_plot) / 2.0
    return abs(mid - size)
