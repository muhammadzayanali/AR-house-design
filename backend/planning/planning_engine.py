"""Deterministic preliminary architectural planning bands.

Source of truth for pre-design space programmes and approximate room sizes.
Selected HouseDesign remains authoritative once chosen.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from .units import sqm_to_sqft, sqm_to_units


def calculate_room_area(length_ft: float, width_ft: float) -> float:
    length = float(length_ft)
    width = float(width_ft)
    if length <= 0 or width <= 0:
        raise ValueError("Room length and width must be > 0")
    return round(length * width, 2)


def _room(length_ft: float, width_ft: float) -> Dict[str, float]:
    return {
        "length_ft": float(length_ft),
        "width_ft": float(width_ft),
        "area_sqft": calculate_room_area(length_ft, width_ft),
    }


def validate_room_program(program: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    if not isinstance(program, dict):
        return False, "room_program_not_object"
    for key, value in program.items():
        if key.endswith("_min") or key.endswith("_max"):
            continue
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)) and value < 0:
            return False, "negative_count:{0}".format(key)
    beds = program.get("bedrooms")
    baths = program.get("bathrooms")
    if isinstance(beds, int) and isinstance(baths, int) and baths > beds + 3:
        return False, "bathrooms_unrealistic_vs_bedrooms"
    return True, None


def validate_planning_profile(profile: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    if not isinstance(profile, dict):
        return False, "profile_not_object"
    sizes = profile.get("room_sizes") or {}
    if not isinstance(sizes, dict):
        return False, "room_sizes_not_object"
    for name, dims in sizes.items():
        if not isinstance(dims, dict):
            return False, "room_dims_invalid:{0}".format(name)
        try:
            length = float(dims["length_ft"])
            width = float(dims["width_ft"])
            area = calculate_room_area(length, width)
        except (KeyError, TypeError, ValueError) as exc:
            return False, "room_dims_error:{0}:{1}".format(name, exc)
        claimed = dims.get("area_sqft")
        if claimed is not None and abs(float(claimed) - area) > 0.6:
            return False, "room_area_mismatch:{0}".format(name)
    ok, reason = validate_room_program(profile.get("room_program") or profile)
    return ok, reason


# Inclusive lower bound, exclusive upper bound except last band.
PLANNING_BANDS: List[Dict[str, Any]] = [
    {
        "id": "0_100",
        "min_sqm": 0,
        "max_sqm": 100,
        "label": "0–100 m² compact",
        "title": "1-storey compact home",
        "recommended_floors": 1,
        "covered_area_m2_min": 35,
        "covered_area_m2_max": 55,
        "coverage_percent_target": 50,
        "room_program": {
            "bedrooms": 1,
            "bathrooms": 1,
            "powder_rooms": 0,
            "kitchens": 1,
            "dirty_kitchens": 0,
            "dining_rooms": 1,
            "drawing_rooms": 0,
            "family_lounges": 0,
            "living_rooms": 1,
            "study_rooms": 0,
            "parking_spaces_min": 0,
            "parking_spaces_max": 1,
            "floors": 1,
        },
        "room_sizes": {
            "bedroom": _room(10, 11),
            "bathroom": _room(5, 7),
            "kitchen": _room(7, 8),
            "living_drawing": _room(10, 12),
            "dining": _room(6, 8),
        },
        "notes": "Very compact programme. Second bedroom only if coverage remains feasible.",
    },
    {
        "id": "100_150",
        "min_sqm": 100,
        "max_sqm": 150,
        "label": "100–150 m² small family",
        "title": "2–3 bedroom small family home",
        "recommended_floors": 2,
        "covered_area_m2_min": 55,
        "covered_area_m2_max": 75,
        "coverage_percent_target": 50,
        "room_program": {
            "bedrooms": 2,
            "bathrooms": 2,
            "powder_rooms": 1,
            "kitchens": 1,
            "dirty_kitchens": 0,
            "dining_rooms": 1,
            "drawing_rooms": 1,
            "family_lounges": 1,
            "living_rooms": 1,
            "study_rooms": 0,
            "parking_spaces_min": 1,
            "parking_spaces_max": 1,
            "floors": 2,
        },
        "room_sizes": {
            "master_bedroom": _room(11, 12),
            "bedroom_2": _room(10, 11),
            "bathroom": _room(5, 7),
            "kitchen": _room(8, 10),
            "dining": _room(8, 9),
            "living_family": _room(11, 13),
            "drawing": _room(9, 11),
            "parking": _room(9, 16),
            "store_laundry": _room(4, 6),
        },
        "notes": "Small family programme. Third bedroom only when covered-area budget allows.",
    },
    {
        "id": "150_220",
        "min_sqm": 150,
        "max_sqm": 220,
        "label": "150–220 m² mid-size family",
        "title": "2-storey compact family villa",
        "recommended_floors": 2,
        "covered_area_m2_min": 80,
        "covered_area_m2_max": 100,
        "coverage_percent_target": 50,
        "room_program": {
            "bedrooms": 3,
            "bathrooms": 3,
            "powder_rooms": 1,
            "kitchens": 1,
            "dirty_kitchens": 0,
            "dining_rooms": 1,
            "drawing_rooms": 1,
            "family_lounges": 1,
            "living_rooms": 1,
            "study_rooms": 0,
            "parking_spaces_min": 1,
            "parking_spaces_max": 2,
            "floors": 2,
        },
        "room_sizes": {
            "master_bedroom": _room(12, 14),
            "bedroom_2": _room(11, 12),
            "bedroom_3": _room(10, 12),
            "master_bathroom": _room(6, 8),
            "bathroom": _room(5, 7),
            "powder": _room(4, 5),
            "kitchen": _room(9, 10),
            "dining": _room(9, 10),
            "drawing": _room(10, 12),
            "living_family": _room(12, 14),
            "family_lounge": _room(10, 12),
            "stair": _room(7, 12),
            "parking": _room(10, 17),
        },
        "notes": "Primary FYP demo band (~180 m²). Parking depends on plot geometry.",
    },
    {
        "id": "220_350",
        "min_sqm": 220,
        "max_sqm": 350,
        "label": "220–350 m² larger family",
        "title": "2-storey 4-bedroom family villa",
        "recommended_floors": 2,
        "covered_area_m2_min": 110,
        "covered_area_m2_max": 150,
        "coverage_percent_target": 48,
        "room_program": {
            "bedrooms": 4,
            "bathrooms": 4,
            "powder_rooms": 1,
            "kitchens": 1,
            "dirty_kitchens": 1,
            "dining_rooms": 1,
            "drawing_rooms": 1,
            "family_lounges": 1,
            "living_rooms": 1,
            "study_rooms": 1,
            "parking_spaces_min": 2,
            "parking_spaces_max": 2,
            "floors": 2,
        },
        "room_sizes": {
            "master_bedroom": _room(13, 15),
            "bedroom_2": _room(11, 13),
            "bedroom_3": _room(11, 12),
            "bedroom_4": _room(11, 13),
            "master_bathroom": _room(7, 9),
            "bathroom": _room(6, 8),
            "powder": _room(5, 6),
            "kitchen": _room(10, 12),
            "dirty_kitchen": _room(7, 9),
            "dining": _room(10, 12),
            "drawing": _room(11, 14),
            "living": _room(13, 15),
            "family_lounge": _room(12, 14),
            "study": _room(8, 10),
            "stair": _room(8, 12),
            "parking": _room(18, 20),
        },
        "notes": "Larger family / villa programme.",
    },
    {
        "id": "350_500",
        "min_sqm": 350,
        "max_sqm": 500,
        "label": "350–500 m² large villa",
        "title": "2-storey 4–5 bedroom villa",
        "recommended_floors": 2,
        "covered_area_m2_min": 160,
        "covered_area_m2_max": 220,
        "coverage_percent_target": 45,
        "room_program": {
            "bedrooms": 5,
            "bathrooms": 5,
            "powder_rooms": 1,
            "kitchens": 1,
            "dirty_kitchens": 1,
            "dining_rooms": 1,
            "drawing_rooms": 1,
            "family_lounges": 2,
            "living_rooms": 1,
            "study_rooms": 1,
            "parking_spaces_min": 2,
            "parking_spaces_max": 3,
            "floors": 2,
        },
        "room_sizes": {
            "master_bedroom": _room(15, 17),
            "dressing": _room(8, 10),
            "master_bathroom": _room(8, 10),
            "bedroom_2": _room(12, 14),
            "bedroom_3": _room(12, 14),
            "bedroom_4": _room(11, 13),
            "guest_bedroom": _room(12, 14),
            "bathroom": _room(6, 8),
            "powder": _room(5, 6),
            "kitchen": _room(12, 12),
            "dirty_kitchen": _room(8, 10),
            "dining": _room(12, 14),
            "drawing": _room(14, 16),
            "formal_living": _room(14, 16),
            "family_lounge": _room(14, 16),
            "study": _room(10, 12),
            "stair": _room(9, 14),
        },
        "notes": "Large villa programme; parking depends on geometry.",
    },
    {
        "id": "500_plus",
        "min_sqm": 500,
        "max_sqm": 10_000,
        "label": "500+ m² luxury / multi-wing",
        "title": "Luxury multi-wing villa (scalable)",
        "recommended_floors": 2,
        "covered_area_m2_min": 220,
        "covered_area_m2_max": 350,
        "coverage_percent_target": 42,
        "room_program": {
            "bedrooms": 5,
            "bathrooms": 5,
            "powder_rooms": 1,
            "kitchens": 1,
            "dirty_kitchens": 1,
            "dining_rooms": 1,
            "drawing_rooms": 1,
            "family_lounges": 2,
            "living_rooms": 1,
            "study_rooms": 1,
            "parking_spaces_min": 2,
            "parking_spaces_max": 4,
            "floors": 2,
        },
        "room_sizes": {
            "master_bedroom": _room(16, 18),
            "bedroom_2": _room(13, 15),
            "bedroom_3": _room(12, 14),
            "bedroom_4": _room(12, 14),
            "bedroom_5": _room(11, 13),
            "kitchen": _room(14, 14),
            "dirty_kitchen": _room(9, 11),
            "dining": _room(14, 16),
            "drawing": _room(16, 18),
            "family_lounge": _room(16, 18),
            "study": _room(12, 14),
            "parking": _room(20, 24),
        },
        "notes": "Scalable luxury template — refine via selected HouseDesign.",
    },
]


def get_planning_band(plot_area_sqm: float) -> Dict[str, Any]:
    size = float(plot_area_sqm)
    for band in PLANNING_BANDS:
        if band["min_sqm"] <= size < band["max_sqm"]:
            return band
    return PLANNING_BANDS[-1]


def target_covered_area_m2(plot_area_sqm: float, band: Optional[Dict[str, Any]] = None) -> float:
    """Preliminary covered footprint target (~coverage_percent_target of plot, clamped)."""
    size = float(plot_area_sqm)
    band = band or get_planning_band(size)
    target_pct = float(band.get("coverage_percent_target") or 50) / 100.0
    raw = size * target_pct
    lo = float(band["covered_area_m2_min"])
    hi = float(band["covered_area_m2_max"])
    return round(min(max(raw, lo), hi), 2)


def build_preliminary_plan(plot_area_sqm: float) -> Dict[str, Any]:
    """Full structured preliminary plan before HouseDesign selection."""
    from .cost_estimate import estimate_construction_cost

    size = float(plot_area_sqm)
    band = get_planning_band(size)
    units = sqm_to_units(size)
    covered = target_covered_area_m2(size, band)
    remaining = round(size - covered, 2)
    coverage = round((covered / size * 100.0) if size > 0 else 0.0, 1)
    program = dict(band["room_program"])
    sizes = {k: dict(v) for k, v in (band.get("room_sizes") or {}).items()}
    ok, reason = validate_planning_profile(
        {"room_program": program, "room_sizes": sizes}
    )
    if not ok:
        raise ValueError("Invalid planning band profile: {0}".format(reason))

    cost = estimate_construction_cost(
        covered_area_m2=covered,
        plot_area_m2=size,
        quality="standard",
        floors=int(program.get("floors") or band["recommended_floors"] or 1),
    )

    # Legacy estimate strings for older UI consumers
    legacy = {
        "bedrooms": str(program.get("bedrooms")),
        "bathrooms": str(program.get("bathrooms")),
        "living": str(program.get("living_rooms") or program.get("family_lounges") or "1"),
        "dining": str(program.get("dining_rooms")),
        "kitchen": str(program.get("kitchens")),
        "parking": "{0}–{1}".format(
            program.get("parking_spaces_min", 0),
            program.get("parking_spaces_max", 0),
        ),
        "notes": band.get("notes") or "",
    }

    return {
        "plot": {
            "area_m2": round(size, 2),
            "area_sqft": units["sqft"],
            "marla": units["marla"],
            "kanal": units["kanal"],
            "acre": units["acre"],
            "display_label": units["display_label"],
        },
        "planning": {
            "band": band["id"],
            "band_label": band["label"],
            "title": band["title"],
            "recommended_floors": band["recommended_floors"],
            "covered_area_m2": covered,
            "covered_area_sqft": sqm_to_sqft(covered),
            "coverage_percent": coverage,
            "remaining_area_m2": remaining,
            "source": "preliminary_band",
        },
        "room_program": program,
        "room_sizes": sizes,
        "cost_estimate": cost,
        "estimate": legacy,
        "disclaimer": (
            "Preliminary planning estimate from configured area bands only. "
            "After you select a catalog design, that design's room programme is authoritative. "
            "Not a structural design, survey, approval, bylaw/FAR calculation, or contractor quotation."
        ),
    }


def design_planning_overlay(house, plot_area_sqm: float, feasibility: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Authoritative plan after HouseDesign selection."""
    from .cost_estimate import estimate_construction_cost
    from .feasibility import compute_feasibility, design_room_program

    size = float(plot_area_sqm)
    units = sqm_to_units(size)
    feas = feasibility or compute_feasibility(size, house)
    program = design_room_program(house)
    sizes = dict(getattr(house, "room_sizes", None) or {})
    # If design has no stored sizes, fall back to band sizes for UX (still mark source)
    size_source = "house_design"
    if not sizes:
        sizes = dict(get_planning_band(size).get("room_sizes") or {})
        size_source = "planning_band_fallback"

    covered = float(feas.get("building_footprint_sqm") or 0)
    cost = estimate_construction_cost(
        covered_area_m2=covered if covered > 0 else target_covered_area_m2(size),
        plot_area_m2=size,
        quality="standard",
        floors=int(house.floors or 1),
    )
    # Prefer catalog cost range when present (design package), keep construction separately
    catalog_min = getattr(house, "estimated_cost_min", None)
    catalog_max = getattr(house, "estimated_cost_max", None)
    catalog_list = getattr(house, "estimated_cost_pkr", None)

    return {
        "plot": {
            "area_m2": round(size, 2),
            "area_sqft": units["sqft"],
            "marla": units["marla"],
            "kanal": units["kanal"],
            "acre": units["acre"],
            "display_label": units["display_label"],
        },
        "planning": {
            "band": get_planning_band(size)["id"],
            "band_label": get_planning_band(size)["label"],
            "title": house.name,
            "recommended_floors": house.floors,
            "covered_area_m2": feas.get("building_footprint_sqm"),
            "covered_area_sqft": sqm_to_sqft(float(feas.get("building_footprint_sqm") or 0)),
            "coverage_percent": feas.get("ground_coverage_percent"),
            "remaining_area_m2": feas.get("remaining_area_sqm"),
            "source": "house_design",
            "room_sizes_source": size_source,
        },
        "room_program": program,
        "room_sizes": sizes,
        "feasibility": feas,
        "cost_estimate": cost,
        "catalog_cost": {
            "currency": getattr(house, "currency", None) or "PKR",
            "list_pkr": catalog_list,
            "min": catalog_min,
            "max": catalog_max,
            "is_estimate": True,
            "source": "HouseDesign catalog",
        },
        "disclaimer": (
            "Room programme from selected HouseDesign is authoritative. "
            "Construction cost is a preliminary Lahore reference estimate, not a quotation."
        ),
    }
