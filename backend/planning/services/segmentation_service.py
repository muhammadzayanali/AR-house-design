"""Semantic segmentation for obstacle-aware AI camera measurement.

Model (HF Inference API — same token pattern as Qwen polish):
  nvidia/segformer-b0-finetuned-ade-512-512  (ADE20K, 150 classes)

Runs server-side only. Never invents plot boundaries — only flags
GROUND vs OBSTACLE so the user can adjust their marked polygon.
"""
from __future__ import annotations

import io
import logging
import os
import threading
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

import numpy as np

logger = logging.getLogger("planning.vision")

DEFAULT_SEG_MODEL = "nvidia/segformer-b0-finetuned-ade-512-512"

# ADE20K / SegFormer label names treated as walkable / markable land.
# Matching is case-insensitive substring on HF Inference label strings.
GROUND_LABEL_KEYWORDS: Tuple[str, ...] = (
    "floor",
    "earth",
    "ground",
    "grass",
    "road",
    "route",
    "sidewalk",
    "pavement",
    "field",
    "path",
    "dirt track",
    "dirt",
    "sand",
    "land",
    "runway",
    "rug",
    "carpet",
)

# Explicit obstacle labels (anything else non-ground is also obstacle).
OBSTACLE_LABEL_KEYWORDS: Tuple[str, ...] = (
    "tree",
    "person",
    "people",
    "car",
    "auto",
    "bus",
    "truck",
    "van",
    "building",
    "edifice",
    "house",
    "plant",
    "flora",
    "fence",
    "wall",
    "rock",
    "stone",
    "column",
    "pole",
    "signboard",
    "sky",
    "ceiling",
    "water",
    "sea",
    "river",
    "mountain",
    "animal",
    "bicycle",
    "minibike",
    "boat",
    "palm",
    "flower",
    "sculpture",
    "tent",
    "hovel",
    "skyscraper",
    "bridge",
)

_lock = threading.Lock()
_service: Optional["SegmentationService"] = None


def get_segmentation_service() -> "SegmentationService":
    global _service
    if _service is None:
        with _lock:
            if _service is None:
                _service = SegmentationService()
    return _service


def reset_segmentation_service_for_tests() -> None:
    global _service
    with _lock:
        _service = None


def label_is_ground(label: str) -> bool:
    text = (label or "").strip().lower()
    if not text:
        return False
    for kw in GROUND_LABEL_KEYWORDS:
        if kw in text:
            return True
    return False


def label_is_named_obstacle(label: str) -> bool:
    text = (label or "").strip().lower()
    for kw in OBSTACLE_LABEL_KEYWORDS:
        if kw in text:
            return True
    return False


class SegmentationService:
    def __init__(self) -> None:
        self.model_id = os.getenv("HF_SEG_MODEL", DEFAULT_SEG_MODEL)
        self._mock = os.getenv("VISION_MOCK", "").lower() in ("1", "true", "yes")
        self._last_error: Optional[str] = None

    def runtime_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_id,
            "mock": self._mock,
            "load_error": self._last_error,
            "via": "huggingface_inference_api" if not self._mock else "mock",
        }

    def segment_bgr(self, bgr: np.ndarray) -> Dict[str, Any]:
        """Return label_map (H×W int), ground_mask (H×W bool), viz, labels."""
        h, w = bgr.shape[:2]
        if self._mock:
            return self._mock_segment(bgr)

        try:
            from django.conf import settings
            from huggingface_hub import InferenceClient
            from PIL import Image

            token = (getattr(settings, "HF_TOKEN", None) or os.getenv("HF_TOKEN") or "").strip()
            if not token or token.startswith("hf_your_token"):
                raise RuntimeError(
                    "HF_TOKEN missing — cannot call SegFormer Inference API. "
                    "Set VISION_MOCK=1 for local tests."
                )

            rgb = bgr[:, :, ::-1]
            pil = Image.fromarray(rgb)
            client = InferenceClient(
                token=token,
                provider=getattr(settings, "HF_PROVIDER", None) or "auto",
                timeout=float(getattr(settings, "HF_TIMEOUT", 45) or 45),
            )
            # image_segmentation → list[{label, score, mask}]
            results = client.image_segmentation(pil, model=self.model_id)
            label_map, ground_mask, labels_present = self._masks_to_maps(results, h, w)
            self._last_error = None
            viz = self._mask_visualization(bgr, ground_mask, label_map)
            return {
                "ok": True,
                "label_map": label_map,
                "ground_mask": ground_mask,
                "labels": labels_present,
                "visualization": viz,
                "model": self.model_id,
                "mock": False,
            }
        except Exception as exc:
            self._last_error = str(exc)
            logger.warning("vision.seg.inference_failed: %s — falling back to all-ground", exc)
            # Fail soft: do not block measurement if seg is down
            ground = np.ones((h, w), dtype=bool)
            labels = [{"label": "earth", "is_ground": True, "note": "segmentation_unavailable"}]
            return {
                "ok": False,
                "label_map": np.zeros((h, w), dtype=np.int32),
                "ground_mask": ground,
                "labels": labels,
                "visualization": None,
                "model": self.model_id,
                "mock": False,
                "error": str(exc),
                "degraded": True,
            }

    def _mock_segment(self, bgr: np.ndarray) -> Dict[str, Any]:
        """Synthetic ADE-like map: ground + optional red obstacle blob for tests."""
        h, w = bgr.shape[:2]
        label_map = np.full((h, w), 9, dtype=np.int32)  # earth
        ground = np.ones((h, w), dtype=bool)
        labels = [{"label": "earth, ground", "is_ground": True}]

        # Detect a bright-green "tree" marker region (tests paint this)
        # OR a dark red blob used as person/tree stand-in.
        hsv_r = bgr[:, :, 2].astype(np.int16)
        hsv_g = bgr[:, :, 1].astype(np.int16)
        hsv_b = bgr[:, :, 0].astype(np.int16)
        # Green-ish tree marker: G high, R+B low
        tree = (hsv_g > 160) & (hsv_r < 100) & (hsv_b < 100)
        # Magenta/red person marker: R high, G+B low
        person = (hsv_r > 160) & (hsv_g < 90) & (hsv_b < 90)
        obstacle = tree | person
        if obstacle.any():
            label_map[tree] = 3  # tree trainId (MaskFormer order)
            label_map[person] = 11  # person
            ground[obstacle] = False
            if tree.any():
                labels.append({"label": "tree", "is_ground": False})
            if person.any():
                labels.append({"label": "person", "is_ground": False})

        viz = self._mask_visualization(bgr, ground, label_map)
        return {
            "ok": True,
            "label_map": label_map,
            "ground_mask": ground,
            "labels": labels,
            "visualization": viz,
            "model": self.model_id,
            "mock": True,
        }

    def _masks_to_maps(
        self,
        results: Sequence[Any],
        h: int,
        w: int,
    ) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]]]:
        from PIL import Image

        label_map = np.full((h, w), -1, dtype=np.int32)
        ground = np.zeros((h, w), dtype=bool)
        labels_present: List[Dict[str, Any]] = []
        # Paint lower-score first, higher-score last (overwrite)
        ordered = sorted(
            list(results or []),
            key=lambda r: float(getattr(r, "score", None) or (r.get("score") if isinstance(r, dict) else 0) or 0),
        )
        for idx, item in enumerate(ordered):
            if isinstance(item, dict):
                label = str(item.get("label") or "")
                mask = item.get("mask")
            else:
                label = str(getattr(item, "label", "") or "")
                mask = getattr(item, "mask", None)
            if mask is None:
                continue
            if isinstance(mask, Image.Image):
                arr = np.array(mask.convert("L"))
            elif isinstance(mask, np.ndarray):
                arr = mask
            else:
                # bytes / path — try PIL
                try:
                    arr = np.array(Image.open(io.BytesIO(mask)).convert("L"))
                except Exception:
                    continue
            if arr.shape[:2] != (h, w):
                import cv2

                arr = cv2.resize(arr, (w, h), interpolation=cv2.INTER_NEAREST)
            binary = arr > 127
            if not binary.any():
                continue
            is_ground = label_is_ground(label)
            label_map[binary] = idx
            if is_ground:
                ground[binary] = True
            else:
                # Named obstacles / unknown non-ground clear ground
                ground[binary] = False
            labels_present.append({"label": label, "is_ground": is_ground})

        # Unlabelled pixels → treat as unknown obstacle (conservative)
        unknown = label_map < 0
        if unknown.any() and not ground.any():
            # If API returned nothing usable, allow measurement
            ground[:] = True
        return label_map, ground, labels_present

    @staticmethod
    def _mask_visualization(
        bgr: np.ndarray,
        ground: np.ndarray,
        label_map: np.ndarray,
    ) -> Optional[str]:
        try:
            from . import vision_opencv as vcv

            cv = vcv.require_cv2()
            overlay = bgr.copy()
            # Ground = soft green tint; obstacle = red
            green = np.zeros_like(overlay)
            green[:, :] = (60, 160, 60)
            red = np.zeros_like(overlay)
            red[:, :] = (40, 40, 200)
            overlay = np.where(ground[..., None], overlay * 0.65 + green * 0.35, overlay * 0.55 + red * 0.45)
            overlay = overlay.astype(np.uint8)
            ok, buf = cv.imencode(".png", overlay)
            if not ok:
                return None
            import base64

            return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
        except Exception as exc:
            logger.warning("vision.seg.viz_failed: %s", exc)
            return None


def pack_ground_mask(ground: np.ndarray, step: int = 2) -> Dict[str, Any]:
    """Downsample bool mask for session storage."""
    small = ground[::step, ::step]
    return {
        "values": small.astype(np.uint8).tolist(),
        "step": step,
        "width": int(ground.shape[1]),
        "height": int(ground.shape[0]),
    }


def unpack_ground_mask(payload: Dict[str, Any]) -> np.ndarray:
    values = np.asarray(payload["values"], dtype=np.uint8)
    step = int(payload.get("step") or 1)
    w = int(payload["width"])
    h = int(payload["height"])
    full = np.repeat(np.repeat(values, step, axis=0), step, axis=1)
    full = full[:h, :w]
    if full.shape[0] < h or full.shape[1] < w:
        pad = np.ones((h, w), dtype=np.uint8)
        pad[: full.shape[0], : full.shape[1]] = full
        full = pad
    return full.astype(bool)


def check_polygon_obstacles(
    ground_mask: np.ndarray,
    points: Sequence[Dict[str, float]],
    *,
    edge_samples: int = 8,
) -> Dict[str, Any]:
    """Flag boundary points / edges that fall on non-ground pixels."""
    h, w = ground_mask.shape[:2]
    offenders: List[Dict[str, Any]] = []
    pts = [(float(p["image_x"]), float(p["image_y"])) for p in points]

    def sample(x: float, y: float) -> bool:
        xi = int(np.clip(round(x), 0, w - 1))
        yi = int(np.clip(round(y), 0, h - 1))
        return bool(ground_mask[yi, xi])

    for i, (x, y) in enumerate(pts):
        if not sample(x, y):
            offenders.append(
                {
                    "kind": "point",
                    "index": i,
                    "image_x": x,
                    "image_y": y,
                    "label_hint": "obstacle",
                }
            )

    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        x0, y0 = pts[i]
        x1, y1 = pts[j]
        for t in range(1, edge_samples):
            a = t / float(edge_samples)
            x = x0 * (1 - a) + x1 * a
            y = y0 * (1 - a) + y1 * a
            if not sample(x, y):
                offenders.append(
                    {
                        "kind": "edge",
                        "index": i,
                        "next_index": j,
                        "image_x": x,
                        "image_y": y,
                        "label_hint": "obstacle",
                    }
                )
                break

    # Interior sample (centroid) — catch tree inside polygon
    if n >= 3:
        cx = sum(p[0] for p in pts) / n
        cy = sum(p[1] for p in pts) / n
        if not sample(cx, cy):
            offenders.append(
                {
                    "kind": "interior",
                    "index": -1,
                    "image_x": cx,
                    "image_y": cy,
                    "label_hint": "obstacle",
                }
            )

    blocked = len(offenders) > 0
    message = None
    if blocked:
        kinds = {o["kind"] for o in offenders}
        message = (
            "A tree/person or other obstacle was detected inside or on your marked area — "
            "please adjust the boundary to exclude it. Area calculation is blocked until resolved."
        )
        if "point" in kinds:
            message = (
                "One or more boundary points fall on an obstacle (tree, person, car, building, etc.). "
                "Move those points onto clear ground before calculating area."
            )
    return {
        "blocked": blocked,
        "offenders": offenders,
        "message": message,
        "user_action": [
            "Move boundary points off trees, people, cars, and walls",
            "Keep the polygon on grass / earth / pavement / road only",
            "Analyze again if the scene changed",
        ]
        if blocked
        else [],
    }
