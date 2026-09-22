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


def area_sqm_from_points(points: Iterable[Mapping[str, float]]) -> float:
    pts = list(points)
    if len(pts) < 2:
        return 0.0
    if len(pts) == 2:
        width = abs(float(pts[0]["x"]) - float(pts[1]["x"]))
        depth = abs(float(pts[0]["z"]) - float(pts[1]["z"]))
        area = width * depth
        if area > 0.5:
            return area
        span = distance_xz(pts[0], pts[1])
        return span * span
    return shoelace_xz(pts)


def rectangle_area_sqm(length_m: float, width_m: float) -> float:
    length = float(length_m)
    width = float(width_m)
    if length <= 0 or width <= 0:
        raise ValueError("length_m and width_m must be > 0")
    return length * width
