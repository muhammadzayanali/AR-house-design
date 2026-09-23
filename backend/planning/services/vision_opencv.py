"""OpenCV helpers for AI camera measurement.

Responsibilities (deterministic image processing / geometry — not AI):
  - resize / denoise / contrast normalization
  - edge detection for overlays
  - depth visualization colour maps
  - ground-plane helpers from depth
  - perspective / homography helpers
"""
from __future__ import annotations

import base64
import io
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore


class OpenCVUnavailable(RuntimeError):
    pass


def require_cv2():
    if cv2 is None:
        raise OpenCVUnavailable(
            "opencv-python-headless is not installed. "
            "Install backend requirements to enable AI camera preprocessing."
        )
    return cv2


def decode_image_bytes(data: bytes) -> np.ndarray:
    """Decode JPEG/PNG bytes → BGR uint8 image."""
    cv = require_cv2()
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv.imdecode(arr, cv.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image — could not decode JPEG/PNG frame.")
    return image


def preprocess_frame(
    bgr: np.ndarray,
    *,
    max_side: int = 640,
) -> Dict[str, Any]:
    """Resize, denoise lightly, normalize contrast. Returns working buffers."""
    cv = require_cv2()
    h0, w0 = bgr.shape[:2]
    scale = 1.0
    if max(h0, w0) > max_side:
        scale = max_side / float(max(h0, w0))
        bgr = cv.resize(
            bgr,
            (int(round(w0 * scale)), int(round(h0 * scale))),
            interpolation=cv.INTER_AREA,
        )
    denoised = cv.bilateralFilter(bgr, d=5, sigmaColor=40, sigmaSpace=40)
    lab = cv.cvtColor(denoised, cv.COLOR_BGR2LAB)
    l, a, b = cv.split(lab)
    l = cv.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
    enhanced = cv.cvtColor(cv.merge([l, a, b]), cv.COLOR_LAB2BGR)
    gray = cv.cvtColor(enhanced, cv.COLOR_BGR2GRAY)
    edges = cv.Canny(gray, 60, 140)
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    return {
        "bgr": enhanced,
        "gray": gray,
        "edges": edges,
        "original_size": (w0, h0),
        "working_size": (enhanced.shape[1], enhanced.shape[0]),
        "scale": scale,
        "brightness": brightness,
        "contrast": contrast,
    }


def depth_to_visualization(depth: np.ndarray) -> str:
    """Return a base64 PNG colour visualisation of a depth map (relative or metric)."""
    cv = require_cv2()
    d = np.asarray(depth, dtype=np.float32)
    finite = np.isfinite(d)
    if not finite.any():
        raise ValueError("Depth map has no finite values.")
    vals = d[finite]
    lo, hi = float(np.percentile(vals, 2)), float(np.percentile(vals, 98))
    if hi <= lo:
        hi = lo + 1e-6
    norm = np.clip((d - lo) / (hi - lo), 0, 1)
    norm = (norm * 255).astype(np.uint8)
    colour = cv.applyColorMap(norm, cv.COLORMAP_INFERNO)
    ok, buf = cv.imencode(".png", colour)
    if not ok:
        raise ValueError("Failed to encode depth visualisation.")
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def estimate_ground_plane(
    depth: np.ndarray,
    *,
    depth_type: str = "relative",
) -> Dict[str, Any]:
    """Estimate a dominant ground plane from the lower portion of the depth map.

    Uses a pinhole unprojection with approximate intrinsics, then RANSAC-like
    plane fitting on the lower 55% of the image (typical ground region).

    Returns plane normal/offset and a confidence label — never invents metres
    from relative depth alone.
    """
    cv = require_cv2()
    h, w = depth.shape[:2]
    fx = fy = float(max(w, h))
    cx, cy = w / 2.0, h / 2.0

    # Sample a grid in the lower part of the frame
    ys = np.linspace(int(h * 0.45), h - 1, num=36, dtype=np.int32)
    xs = np.linspace(0, w - 1, num=48, dtype=np.int32)
    xx, yy = np.meshgrid(xs, ys)
    zz = depth[yy, xx].astype(np.float64)

    if depth_type == "relative":
        # Depth Anything outputs disparity-like values (larger ≈ closer).
        # Convert to a positive pseudo-depth for plane fitting only.
        z_vals = zz.copy()
        z_vals = z_vals - np.nanmin(z_vals) + 1e-3
        z_vals = 1.0 / z_vals
    else:
        z_vals = zz.copy()
        z_vals[~np.isfinite(z_vals)] = np.nan
        z_vals[z_vals <= 0] = np.nan

    valid = np.isfinite(z_vals) & (z_vals > 0)
    if valid.sum() < 40:
        return {
            "ok": False,
            "confidence": "LOW",
            "reason": "Insufficient valid depth samples for ground plane.",
            "inlier_ratio": 0.0,
        }

    u = xx[valid].astype(np.float64)
    v = yy[valid].astype(np.float64)
    z = z_vals[valid].astype(np.float64)
    x = (u - cx) * z / fx
    y = (v - cy) * z / fy
    pts = np.stack([x, y, z], axis=1)

    # RANSAC plane fit: ax + by + cz + d = 0 with ||n||=1
    rng = np.random.default_rng(42)
    best_inliers = 0
    best_model = None
    n_pts = pts.shape[0]
    iterations = min(120, max(40, n_pts // 3))
    for _ in range(iterations):
        idx = rng.choice(n_pts, size=3, replace=False)
        p0, p1, p2 = pts[idx]
        normal = np.cross(p1 - p0, p2 - p0)
        norm = np.linalg.norm(normal)
        if norm < 1e-8:
            continue
        normal = normal / norm
        d = -float(np.dot(normal, p0))
        dist = np.abs(pts @ normal + d)
        inliers = int(np.sum(dist < 0.08 * (np.median(z) + 1e-3)))
        if inliers > best_inliers:
            best_inliers = inliers
            best_model = (normal, d)

    if best_model is None or best_inliers < 25:
        return {
            "ok": False,
            "confidence": "LOW",
            "reason": "Could not fit a stable ground plane.",
            "inlier_ratio": float(best_inliers) / float(n_pts),
        }

    normal, d = best_model
    # Prefer an upward-ish plane (camera y down in image space → mixed).
    # Score by inlier ratio + how horizontal the plane is in camera coords.
    inlier_ratio = float(best_inliers) / float(n_pts)
    # Horizontal ground in camera frame tends to have dominant Y component of normal.
    horizontal_score = abs(float(normal[1]))
    if inlier_ratio >= 0.55 and horizontal_score >= 0.35:
        confidence = "HIGH"
    elif inlier_ratio >= 0.35:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return {
        "ok": confidence != "LOW",
        "confidence": confidence,
        "inlier_ratio": round(inlier_ratio, 3),
        "normal": [float(v) for v in normal],
        "offset": float(d),
        "intrinsics": {"fx": fx, "fy": fy, "cx": cx, "cy": cy, "width": w, "height": h},
        "reason": "Ground plane estimated from depth samples."
        if confidence != "LOW"
        else "Ground plane fit is weak — try a clearer view of the plot.",
    }


def lighting_quality(brightness: float, contrast: float) -> str:
    if brightness < 35 or contrast < 18:
        return "LOW"
    if brightness < 55 or contrast < 28:
        return "MEDIUM"
    return "HIGH"


def encode_jpeg_b64(bgr: np.ndarray, quality: int = 85) -> str:
    cv = require_cv2()
    ok, buf = cv.imencode(".jpg", bgr, [int(cv.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise ValueError("Failed to encode JPEG.")
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def perspective_warp_quad(
    image_points: Sequence[Tuple[float, float]],
    *,
    width_m: Optional[float] = None,
    height_m: Optional[float] = None,
) -> Optional[np.ndarray]:
    """Return a 3×3 homography mapping quad → unit/metric rectangle, or None."""
    cv = require_cv2()
    if len(image_points) != 4:
        return None
    src = np.array(image_points, dtype=np.float32)
    w = float(width_m or 1.0)
    h = float(height_m or 1.0)
    dst = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)
    return cv.getPerspectiveTransform(src, dst)
