"""Structured FACT / ESTIMATE / LIMITATION context for AI grounding.

Backend calculation engines remain the only source of numerical truth.
LLM/RAG may explain these values but must not invent replacements.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


LIMITATIONS: List[str] = [
    "Plot measurement is approximate planning guidance, not a professional land survey.",
    "This system is not a certified surveying, architectural, or municipal approval tool.",
    "Feasibility checks footprint fit and coverage only — not setbacks, FAR/FSI, or full bylaws.",
    "The system does not verify building-code compliance or legal approval.",
    "Catalog cost values are preliminary estimates, not quotations or BOQs.",
    "Procedural 3D is real-time architectural visualization, not photoreal CGI.",
    "AI/consultant text explains stored facts; it does not recalculate measurements.",
]


def build_grounded_context(facts: Dict[str, Any]) -> Dict[str, Any]:
    """Split project_facts into explicit facts / estimates / limitations."""
    feas = facts.get("feasibility") or {}
    rooms = facts.get("room_program") or {}
    prelim = facts.get("preliminary_space") or {}

    verified_facts: Dict[str, Any] = {
        "plot_area_sqm": facts.get("land_size_sqm"),
        "plot_marla": facts.get("land_size_marla"),
        "plot_kanal": facts.get("land_size_kanal"),
        "plot_acre": facts.get("land_size_acre"),
        "plot_length_m": facts.get("plot_length_m"),
        "plot_width_m": facts.get("plot_width_m"),
        "measurement_type": facts.get("measurement_type"),
        "selected_style": facts.get("preferred_style") or facts.get("house_style"),
        "selected_design": facts.get("house_name"),
        "building_footprint_sqm": feas.get("building_footprint_sqm")
        or facts.get("building_footprint_sqm"),
        "building_width_m": facts.get("building_width_m") or feas.get("building_width_m"),
        "building_depth_m": facts.get("building_depth_m") or feas.get("building_depth_m"),
        "floors": rooms.get("floors", facts.get("floors")),
        "bedrooms": rooms.get("bedrooms", facts.get("bedrooms")),
        "bathrooms": rooms.get("bathrooms", facts.get("bathrooms")),
        "living_rooms": rooms.get("living_rooms"),
        "family_rooms": rooms.get("family_rooms"),
        "dining_rooms": rooms.get("dining_rooms"),
        "kitchens": rooms.get("kitchens"),
        "parking_spaces": rooms.get("parking_spaces"),
        "balconies": rooms.get("balconies"),
        "terraces": rooms.get("terraces"),
        "garage": rooms.get("garage"),
        "pool": rooms.get("pool"),
        "garden": rooms.get("garden"),
        "remaining_area_sqm": feas.get("remaining_area_sqm"),
        "coverage_percent": feas.get("ground_coverage_percent"),
        "feasibility_status": feas.get("status"),
        "recommendation_reason": facts.get("recommendation_reason"),
        "model_type": facts.get("model_type"),
        "plot_range_min_sqm": facts.get("plot_range_min"),
        "plot_range_max_sqm": facts.get("plot_range_max"),
    }

    estimates: Dict[str, Any] = {
        "cost_min": facts.get("estimated_cost_min"),
        "cost_max": facts.get("estimated_cost_max"),
        "cost_list_pkr": facts.get("estimated_cost_pkr"),
        "currency": facts.get("currency") or "PKR",
        "preliminary_space_bands": prelim.get("estimate"),
        "preliminary_space_disclaimer": prelim.get("disclaimer"),
        "cost_disclaimer": (
            "Cost figures are catalog preliminary estimates only — "
            "not a contractor quotation, BOQ, or market bid."
        ),
    }

    return {
        "facts": verified_facts,
        "estimates": estimates,
        "limitations": list(LIMITATIONS),
        "meta": {
            "project_id": facts.get("project_id"),
            "project_name": facts.get("project_name"),
            "source_of_truth": (
                "Deterministic Django engines (units, recommendation, feasibility) "
                "+ HouseDesign catalog. LLM must not alter facts."
            ),
        },
    }


def match_reason_block(
    *,
    plot_area: float,
    land_label: str,
    house,
    feasibility: Optional[Dict[str, Any]] = None,
    exact: bool = True,
) -> str:
    """Deterministic human-readable match reason from DB + feasibility."""
    lo = house.effective_min_plot
    hi = house.effective_max_plot
    foot = float(getattr(house, "building_footprint_sqm", 0) or 0)
    if foot <= 0:
        foot = float(house.building_width_m or 0) * float(house.building_depth_m or 0)
    cov = None
    rem = None
    if feasibility:
        cov = feasibility.get("ground_coverage_percent")
        rem = feasibility.get("remaining_area_sqm")
    elif plot_area > 0 and foot > 0:
        rem = round(plot_area - foot, 2)
        cov = round(foot / plot_area * 100.0, 1)

    kind = "exact match" if exact else "nearby / closest-fit (not an exact range match)"
    lines = [
        "Recommended because ({kind}):".format(kind=kind),
        "- Plot area: {0:.1f} m² ({1})".format(plot_area, land_label),
        "- Design recommended range: {0:.0f}–{1:.0f} m²".format(lo, hi),
        "- Selected design: {0} ({1})".format(house.name, house.style),
        "- Building footprint: {0:.0f} m² ({1}×{2} m)".format(
            foot, house.building_width_m, house.building_depth_m
        ),
    ]
    if rem is not None:
        lines.append("- Remaining open area: {0:.0f} m²".format(rem))
    if cov is not None:
        lines.append("- Preliminary coverage: {0}%".format(cov))
    lines.append(
        "- This match is a deterministic catalog/range lookup, not an LLM decision."
    )
    return "\n".join(lines)
