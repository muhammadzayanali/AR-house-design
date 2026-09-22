"""Master FYP test dataset — single source of expected values.

Use the same numbers in unit tests, E2E fixtures, docs, and viva demos.
"""
from __future__ import annotations

# Case 1 — primary demo (Italian Compact Villa path)
CASE_15X12 = {
    "id": "case_15x12",
    "length_m": 15.0,
    "width_m": 12.0,
    "area_sqm": 180.0,
    "marla": 7.117,
    "kanal": 0.3558,
    "acre": 0.04448,
    "polygon_xz": [
        {"x": 0, "y": 0, "z": 0},
        {"x": 15, "y": 0, "z": 0},
        {"x": 15, "y": 0, "z": 12},
        {"x": 0, "y": 0, "z": 12},
    ],
    "style": "Italian Villa",
    "design_name": "Italian Compact Villa",
    "building_width_m": 10.0,
    "building_depth_m": 9.0,
    "footprint_sqm": 90.0,
    "remaining_sqm": 90.0,
    "coverage_percent": 50.0,
    "plot_range": (120.0, 180.0),
}

CASE_10X20 = {
    "id": "case_10x20",
    "length_m": 10.0,
    "width_m": 20.0,
    "area_sqm": 200.0,
}

CASE_10X10 = {
    "id": "case_10x10",
    "length_m": 10.0,
    "width_m": 10.0,
    "area_sqm": 100.0,
}

CASE_TRIANGLE_50 = {
    "id": "case_triangle_50",
    "polygon_xz": [
        {"x": 0, "y": 0, "z": 0},
        {"x": 10, "y": 0, "z": 0},
        {"x": 0, "y": 0, "z": 10},
    ],
    "area_sqm": 50.0,
}

ALL_CASES = [CASE_15X12, CASE_10X20, CASE_10X10, CASE_TRIANGLE_50]
