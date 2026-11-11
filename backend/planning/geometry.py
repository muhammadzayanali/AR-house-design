"""Backend polygon / rectangle area helpers (metres).

Mirrors frontend/lib/geometry/area.ts for validation and tests.
"""
from __future__ import annotations

from typing import Iterable, Mapping, Sequence


def distance_xz(a: Mapping[str, float], b: Mapping[str, float]) -> float:
    dx = float(a["x"]) - float(b["x"])
    dz = float(a["z"]) - float(b["z"])
    return (dx * dx + dz * dz) ** 0.5


def shoelace_xz(points: Sequence[Mapping[str, float]]) -> float:
    if len(points) < 3:
        return 0.0
    acc = 0.0
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        acc += float(points[i]["x"]) * float(points[j]["z"])
        acc -= float(points[j]["x"]) * float(points[i]["z"])
    return abs(acc) / 2.0


def _cross(o: Mapping[str, float], a: Mapping[str, float], b: Mapping[str, float]) -> float:
    return (float(a["x"]) - float(o["x"])) * (float(b["z"]) - float(o["z"])) - (
        float(a["z"]) - float(o["z"])
    ) * (float(b["x"]) - float(o["x"]))


def _segments_cross(a, b, c, d) -> bool:
    """True when open segments AB and CD cross. Shared endpoints do not count."""
    o1 = _cross(a, b, c)
    o2 = _cross(a, b, d)
    o3 = _cross(c, d, a)
    o4 = _cross(c, d, b)
    if o1 == 0 or o2 == 0 or o3 == 0 or o4 == 0:
        return False
    return (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0)


def _self_intersects(pts: Sequence[Mapping[str, float]]) -> bool:
    n = len(pts)
    if n < 4:
        return False
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        for j in range(i + 1, n):
            if abs(i - j) <= 1 or abs(i - j) == n - 1:
                continue
            c, d = pts[j], pts[(j + 1) % n]
            if _segments_cross(a, b, c, d):
                return True
    return False


def assess_polygon(points: Iterable[Mapping[str, float]]) -> dict:
    """Polygon area for corners tapped in order.

    Two points are not a plot. Length × width is rectangle_area_sqm only.
    Collinear corners and bow-ties are rejected. Nothing is squared from a span.
    """
    pts = list(points)
    if len(pts) < 2:
        return {"status": "empty", "area_sqm": 0.0, "message": "Mark at least three corners."}
    if len(pts) == 2:
        return {
            "status": "need_third_corner",
            "area_sqm": 0.0,
            "message": "Two corners are not a plot. Mark a third corner, or use length × width.",
        }
    if _self_intersects(pts):
        return {
            "status": "self_intersecting",
            "area_sqm": 0.0,
            "message": "Those corners cross. Tap them in order around the boundary.",
        }
    area = shoelace_xz(pts)
    if area < 0.05:
        return {
            "status": "collinear",
            "area_sqm": 0.0,
            "message": "Those corners are almost in a line. Walk the boundary, not a single edge.",
        }
    return {"status": "ok", "area_sqm": area, "message": ""}


def area_sqm_from_points(points: Iterable[Mapping[str, float]]) -> float:
    return float(assess_polygon(points)["area_sqm"])


def rectangle_area_sqm(length_m: float, width_m: float) -> float:
    length = float(length_m)
    width = float(width_m)
    if length <= 0 or width <= 0:
        raise ValueError("length_m and width_m must be > 0")
    return length * width
