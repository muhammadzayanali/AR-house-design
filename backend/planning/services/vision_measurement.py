"""Deterministic vision → real-world plot measurement.

Converts image points + depth + user calibration into XZ world metres,
then reuses existing shoelace / unit conversion.

Critical rules:
  - Relative depth alone NEVER becomes metres.
  - User reference calibration is required for metric area.
  - LLM is not involved.
"""
from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

import numpy as np

from planning.geometry import area_sqm_from_points
from planning.units import sqm_to_units

from . import vision_opencv as vcv


LIMITATIONS = [
    "Approximate camera-based measurement",
    "Not survey-grade",
    "Requires clear view of the plot and a known reference length",
]


def _worst_quality(*levels: str) -> str:
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    return max(levels, key=lambda x: order.get(x, 2))


def analyse_frame(
    image_bytes: bytes,
    *,
    depth_service=None,
) -> Dict[str, Any]:
    """Preprocess one camera frame + run depth estimation + ground plane check."""
    t_preprocess = 0.0
    t_depth = 0.0
    t_plane = 0.0
    import time

    t0 = time.perf_counter()
    bgr = vcv.decode_image_bytes(image_bytes)
    prep = vcv.preprocess_frame(bgr)
    t_preprocess = (time.perf_counter() - t0) * 1000

    light_q = vcv.lighting_quality(prep["brightness"], prep["contrast"])

    if depth_service is None:
        from .depth_model_service import get_depth_model_service

        depth_service = get_depth_model_service()

    t1 = time.perf_counter()
    try:
        depth_result = depth_service.estimate_depth(prep["bgr"])
        depth_ok = True
        depth_error = None
    except Exception as exc:
        depth_result = None
        depth_ok = False
        depth_error = str(exc)
    t_depth = (time.perf_counter() - t1) * 1000

    plane: Dict[str, Any] = {
        "ok": False,
        "confidence": "LOW",
        "reason": depth_error or "Depth unavailable.",
        "inlier_ratio": 0.0,
    }
    viz = None
    depth_type = "relative"
    depth_array = None

    if depth_ok and depth_result is not None:
        depth_array = depth_result["depth"]
        depth_type = depth_result["depth_type"]
        t2 = time.perf_counter()
        plane = vcv.estimate_ground_plane(depth_array, depth_type=depth_type)
        t_plane = (time.perf_counter() - t2) * 1000
        try:
            viz = vcv.depth_to_visualization(depth_array)
        except Exception:
            viz = None

    quality = _worst_quality(light_q, plane.get("confidence", "LOW"))
    if not depth_ok:
        quality = "LOW"

    # Pack a compact depth payload for measurement.
    # Prefer server-side session_id (temporary memory only — no JPEG retention).
    # Client may still echo depth_session for offline/legacy, but session_id is preferred.
    depth_payload = None
    session_id = None
    if depth_array is not None:
        # Downsample for JSON / memory transport
        step = max(1, max(depth_array.shape) // 160)
        small = depth_array[::step, ::step]
        depth_payload = {
            "values": small.astype(np.float32).tolist(),
            "step": step,
            "width": int(depth_array.shape[1]),
            "height": int(depth_array.shape[0]),
            "type": depth_type,
            "plane": {
                "ok": bool(plane.get("ok")),
                "confidence": plane.get("confidence"),
                "normal": plane.get("normal"),
                "offset": plane.get("offset"),
                "intrinsics": plane.get("intrinsics"),
                "inlier_ratio": plane.get("inlier_ratio"),
            },
        }
        if plane.get("ok"):
            from .depth_session_store import put_depth_session

            session_id = put_depth_session(depth_payload)

    message = "Depth estimated successfully." if depth_ok else (
        "Unable to estimate depth. " + (depth_error or "")
    )
    if depth_ok and not plane.get("ok"):
        message = (
            "The camera could not confidently determine the ground plane. "
            "Please move to a clearer view, improve lighting, keep the camera "
            "steady, try again, or use manual measurement."
        )

    return {
        "success": depth_ok and bool(plane.get("ok")),
        "depth_available": depth_ok,
        "depth_type": depth_type,
        "session_id": session_id,
        "width": prep["working_size"][0],
        "height": prep["working_size"][1],
        "confidence": None,  # no invented percentage
        "quality": quality,
        "lighting_quality": light_q,
        "ground_plane": {
            "ok": bool(plane.get("ok")),
            "confidence": plane.get("confidence"),
            "reason": plane.get("reason"),
            "inlier_ratio": plane.get("inlier_ratio"),
        },
        "depth_visualization": viz,
        "visualization": viz,
        # Prefer session_id; depth_session kept for backward compatibility / offline echo
        "depth_session": depth_payload,
        "message": message,
        "limitations": list(LIMITATIONS),
        "timings_ms": {
            "preprocess_ms": round(t_preprocess, 1),
            "inference_ms": round(t_depth, 1),
            "plane_ms": round(t_plane, 1),
            "total_ms": round(t_preprocess + t_depth + t_plane, 1),
        },
        "runtime": depth_service.runtime_info() if depth_service else None,
        "guidance": [
            "Point the camera toward the plot/ground area.",
            "Keep the camera steady.",
            "Avoid very dark or heavily occluded scenes.",
            "After analysis, select boundary points and enter a known reference length.",
        ],
    }


def _rebuild_depth(session: Mapping[str, Any]) -> Tuple[np.ndarray, Dict[str, Any]]:
    values = np.asarray(session["values"], dtype=np.float32)
    step = int(session.get("step") or 1)
    w = int(session["width"])
    h = int(session["height"])
    # Upsample nearest back to working resolution
    full = np.repeat(np.repeat(values, step, axis=0), step, axis=1)
    full = full[:h, :w]
    if full.shape[0] < h or full.shape[1] < w:
        pad = np.full((h, w), float(np.nanmean(values)), dtype=np.float32)
        pad[: full.shape[0], : full.shape[1]] = full
        full = pad
    plane = session.get("plane") or {}
    return full, plane


def _sample_depth(depth: np.ndarray, x: float, y: float) -> float:
    h, w = depth.shape[:2]
    xi = int(np.clip(round(x), 0, w - 1))
    yi = int(np.clip(round(y), 0, h - 1))
    val = float(depth[yi, xi])
    if not np.isfinite(val):
        # neighbourhood mean
        y0, y1 = max(0, yi - 2), min(h, yi + 3)
        x0, x1 = max(0, xi - 2), min(w, xi + 3)
        patch = depth[y0:y1, x0:x1]
        finite = patch[np.isfinite(patch)]
        if finite.size == 0:
            raise ValueError("Missing depth at point ({0}, {1}).".format(x, y))
        val = float(np.mean(finite))
    return val


def _pseudo_metric_depth(raw: float, depth_type: str) -> float:
    if depth_type == "metric":
        if raw <= 0 or not np.isfinite(raw):
            raise ValueError("Invalid metric depth sample.")
        return float(raw)
    # Relative / disparity-like → positive pseudo-depth (scale free)
    v = float(raw)
    v = abs(v) + 1e-4
    return 1.0 / v


def image_points_to_world(
    points: Sequence[Mapping[str, float]],
    depth: np.ndarray,
    plane: Mapping[str, Any],
    *,
    depth_type: str = "relative",
) -> List[Dict[str, float]]:
    """Unproject image points with depth, then project onto the ground plane → XZ."""
    intr = plane.get("intrinsics") or {}
    h, w = depth.shape[:2]
    fx = float(intr.get("fx") or max(w, h))
    fy = float(intr.get("fy") or max(w, h))
    cx = float(intr.get("cx") or w / 2.0)
    cy = float(intr.get("cy") or h / 2.0)
    normal = np.asarray(plane.get("normal") or [0.0, 1.0, 0.0], dtype=np.float64)
    offset = float(plane.get("offset") or 0.0)
    n_norm = np.linalg.norm(normal)
    if n_norm < 1e-8:
        raise ValueError("Invalid ground plane normal.")
    normal = normal / n_norm

    world: List[Dict[str, float]] = []
    for p in points:
        u = float(p["image_x"])
        v = float(p["image_y"])
        raw_d = _sample_depth(depth, u, v)
        z = _pseudo_metric_depth(raw_d, depth_type)
        # Camera ray
        x_c = (u - cx) * z / fx
        y_c = (v - cy) * z / fy
        cam = np.array([x_c, y_c, z], dtype=np.float64)
        # Intersect ray from origin through cam with plane n·X + d = 0
        denom = float(np.dot(normal, cam))
        if abs(denom) < 1e-8:
            # Ray parallel to plane — fall back to depth point itself
            hit = cam
        else:
            t = -offset / denom
            if t <= 0:
                hit = cam
            else:
                hit = t * (cam / (np.linalg.norm(cam) + 1e-12)) * np.linalg.norm(cam)
                # More stable: parametric ray origin=0, direction=cam
                hit = (-offset / denom) * cam
        # Map camera XZ onto plot XZ (drop camera Y as height)
        world.append(
            {
                "image_x": u,
                "image_y": v,
                "world_x": float(hit[0]),
                "world_y": 0.0,
                "world_z": float(hit[2]),
                "x": float(hit[0]),
                "y": 0.0,
                "z": float(hit[2]),
            }
        )
    return world


def apply_user_calibration(
    world_points: List[Dict[str, float]],
    *,
    ref_a_index: int,
    ref_b_index: int,
    known_length_m: float,
) -> Tuple[List[Dict[str, float]], float]:
    """Scale uncalibrated world points so |A−B| equals known_length_m."""
    if known_length_m <= 0:
        raise ValueError("known_length_m must be > 0")
    if ref_a_index < 0 or ref_b_index < 0:
        raise ValueError("Calibration point indices must be >= 0")
    if ref_a_index >= len(world_points) or ref_b_index >= len(world_points):
        raise ValueError("Calibration indices out of range for boundary points.")
    if ref_a_index == ref_b_index:
        raise ValueError("Calibration points must be distinct.")

    a = world_points[ref_a_index]
    b = world_points[ref_b_index]
    dx = a["x"] - b["x"]
    dz = a["z"] - b["z"]
    observed = (dx * dx + dz * dz) ** 0.5
    if observed < 1e-8:
        raise ValueError(
            "Calibration points project to nearly the same location. "
            "Pick two well-separated points on the ground."
        )
    scale = float(known_length_m) / observed
    scaled: List[Dict[str, float]] = []
    for p in world_points:
        sx = float(p["x"]) * scale
        sz = float(p["z"]) * scale
        scaled.append(
            {
                **p,
                "world_x": sx,
                "world_z": sz,
                "x": sx,
                "z": sz,
                "y": 0.0,
                "world_y": 0.0,
            }
        )
    return scaled, scale


def measure_from_session(
    *,
    depth_session: Mapping[str, Any],
    boundary_points: Sequence[Mapping[str, float]],
    calibration: Mapping[str, Any],
    quality_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """Full measure path: depth session + points + user reference → area."""
    if not depth_session:
        raise ValueError("Missing depth session. Analyze a scene first.")
    depth_type = str(depth_session.get("type") or "relative").lower()
    reject_relative_without_calibration(depth_type, calibration)

    known = float(calibration.get("known_length_m") or 0)
    if known <= 0:
        raise ValueError(
            "Metric calibration is required before calculating real-world "
            "dimensions from relative depth. Enter a known reference length > 0 metres."
        )

    pts = list(boundary_points)
    if len(pts) < 3:
        raise ValueError("Provide at least 3 boundary points (or 4 for a rectangle).")
    for p in pts:
        if "image_x" not in p or "image_y" not in p:
            raise ValueError("Each point needs image_x and image_y.")
        try:
            float(p["image_x"])
            float(p["image_y"])
        except (TypeError, ValueError) as exc:
            raise ValueError("Point coordinates must be numeric.") from exc

    if "values" not in depth_session or "width" not in depth_session:
        raise ValueError("Invalid or expired depth session. Analyze the scene again.")

    depth, plane = _rebuild_depth(depth_session)
    if not plane.get("ok"):
        raise ValueError(
            plane.get("reason")
            or "Ground plane was not confident. Re-analyze or use manual measurement."
        )

    world = image_points_to_world(pts, depth, plane, depth_type=depth_type)

    # Calibration reference may be two boundary indices OR two extra image points.
    if "ref_a_index" in calibration and "ref_b_index" in calibration:
        ref_a = int(calibration["ref_a_index"])
        ref_b = int(calibration["ref_b_index"])
        scaled, scale = apply_user_calibration(
            world, ref_a_index=ref_a, ref_b_index=ref_b, known_length_m=known
        )
    elif "ref_a" in calibration and "ref_b" in calibration:
        ref_pts = [
            {"image_x": calibration["ref_a"]["image_x"], "image_y": calibration["ref_a"]["image_y"]},
            {"image_x": calibration["ref_b"]["image_x"], "image_y": calibration["ref_b"]["image_y"]},
        ]
        ref_world = image_points_to_world(ref_pts, depth, plane, depth_type=depth_type)
        # Temporarily append refs to compute scale, then drop
        combined = world + ref_world
        scaled_all, scale = apply_user_calibration(
            combined,
            ref_a_index=len(world),
            ref_b_index=len(world) + 1,
            known_length_m=known,
        )
        scaled = scaled_all[: len(world)]
    else:
        raise ValueError(
            "Metric calibration is required before calculating real-world "
            "dimensions from relative depth. Provide ref_a_index/ref_b_index "
            "or ref_a/ref_b image points plus known_length_m."
        )

    # Reject claiming metric from relative without scale (already applied)
    if depth_type == "relative" and scale <= 0:
        raise ValueError(
            "Metric calibration is required before calculating real-world "
            "dimensions from relative depth."
        )

    area = area_sqm_from_points(scaled)
    if area <= 0:
        raise ValueError("Invalid polygon — computed area was zero.")
    if not np.isfinite(area):
        raise ValueError("Invalid polygon — non-finite area.")

    units = sqm_to_units(area)
    quality = quality_hint or plane.get("confidence") or "MEDIUM"
    if known < 0.3:
        quality = _worst_quality(quality, "LOW")
    elif known < 1.0:
        quality = _worst_quality(quality, "MEDIUM")

    return {
        "success": True,
        "measurement": {
            "area_m2": units["sqm"],
            "area_sqft": units["sqft"],
            "marla": units["marla"],
            "kanal": units["kanal"],
            "acre": units["acre"],
            "display_label": units["display_label"],
        },
        "quality": quality,
        "depth": {
            "available": True,
            "type": depth_type,
        },
        "points": [
            {
                "image_x": p["image_x"],
                "image_y": p["image_y"],
                "world_x": p["world_x"],
                "world_z": p["world_z"],
            }
            for p in scaled
        ],
        "world_points": [{"x": p["x"], "y": 0.0, "z": p["z"]} for p in scaled],
        "calibration": {
            "method": "user_reference",
            "known_length_m": known,
            "scale_factor": scale,
        },
        "limitations": list(LIMITATIONS),
        "land_units": units,
    }


def calibration_is_usable(calibration: Optional[Mapping]) -> bool:
    if not calibration:
        return False
    try:
        return float(calibration.get("known_length_m") or 0) > 0
    except (TypeError, ValueError):
        return False


def reject_relative_without_calibration(depth_type: str, calibration: Optional[Mapping]) -> None:
    """Mandatory guard used by tests and API."""
    if depth_type == "relative" and not calibration_is_usable(calibration):
        raise ValueError(
            "Metric calibration is required before calculating real-world "
            "dimensions from relative depth. "
            "Relative depth + no scale = DO NOT return exact metres."
        )
