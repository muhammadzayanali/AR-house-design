"""Lazy-loaded Hugging Face depth estimation service (singleton per process).

Selected model (FYP default — free / Apache-2.0):
  depth-anything/Depth-Anything-V2-Small-hf

Why this model (see docs/AI_CAMERA_MEASUREMENT.md):
  - Apache-2.0 → free to download and run locally (no paid Inference API required)
  - ~24.8M params → practical on CPU for a student FYP
  - Official Hugging Face Transformers `depth-estimation` pipeline support
  - Relative depth only → metric scale MUST come from user calibration

DepthPro was evaluated but rejected for default: Apple-ASCL licence, ~1B params,
heavier CPU cost. Depth Anything Base/Large are CC-BY-NC (not free for commercial).

Images are never stored — inference runs in memory and buffers are discarded.
"""
from __future__ import annotations

import os
import threading
import time
from typing import Any, Dict, Optional

import numpy as np

_lock = threading.Lock()
_service: Optional["DepthModelService"] = None


def get_depth_model_service() -> "DepthModelService":
    global _service
    if _service is None:
        with _lock:
            if _service is None:
                _service = DepthModelService()
    return _service


def reset_depth_model_service_for_tests() -> None:
    """Test helper — clears the singleton."""
    global _service
    with _lock:
        _service = None


class DepthModelService:
    """Loads the depth model once on first use; CUDA if available else CPU."""

    def __init__(self) -> None:
        self.model_id = os.getenv(
            "HF_DEPTH_MODEL",
            "depth-anything/Depth-Anything-V2-Small-hf",
        )
        self.depth_type = os.getenv("HF_DEPTH_TYPE", "relative").strip().lower()
        if self.depth_type not in ("relative", "metric"):
            self.depth_type = "relative"
        self._pipe = None
        self._device = "cpu"
        self._load_error: Optional[str] = None
        self._loaded = False
        # VISION_MOCK=1 → synthetic relative depth (unit tests / CI without torch)
        self._mock = os.getenv("VISION_MOCK", "").lower() in ("1", "true", "yes")

    @property
    def is_ready(self) -> bool:
        return self._loaded and self._pipe is not None

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    def runtime_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_id,
            "device": self._device,
            "depth_type": self.depth_type,
            "loaded": self._loaded,
            "mock": self._mock,
            "load_error": self._load_error,
        }

    def ensure_loaded(self) -> None:
        if self._loaded:
            return
        with _lock:
            if self._loaded:
                return
            if self._mock:
                self._device = "cpu"
                self._pipe = "mock"
                self._loaded = True
                return
            try:
                import torch
                from transformers import pipeline

                self._device = "cuda" if torch.cuda.is_available() else "cpu"
                self._pipe = pipeline(
                    task="depth-estimation",
                    model=self.model_id,
                    device=0 if self._device == "cuda" else -1,
                )
                self._loaded = True
                self._load_error = None
            except Exception as exc:  # pragma: no cover - depends on env
                self._load_error = str(exc)
                self._pipe = None
                self._loaded = False
                raise RuntimeError(
                    "Depth model unavailable: {0}. "
                    "Install torch+transformers or set VISION_MOCK=1 for tests. "
                    "You can still use Manual Measurement.".format(exc)
                ) from exc

    def estimate_depth(self, bgr_image: np.ndarray) -> Dict[str, Any]:
        """Run depth estimation on a BGR OpenCV image.

        Returns depth map (H×W float32), type, timings. Does not claim metres
        unless depth_type == 'metric' AND the configured model is metric.
        """
        t0 = time.perf_counter()
        self.ensure_loaded()
        t_load = time.perf_counter()

        from PIL import Image

        # BGR → RGB PIL
        rgb = bgr_image[:, :, ::-1]
        pil = Image.fromarray(rgb)

        if self._mock or self._pipe == "mock":
            depth = self._synthetic_depth(bgr_image)
        else:
            result = self._pipe(pil)
            depth_img = result["depth"]
            depth = np.array(depth_img, dtype=np.float32)
            # Ensure spatial size matches working image
            if depth.shape[:2] != bgr_image.shape[:2]:
                import cv2

                depth = cv2.resize(
                    depth,
                    (bgr_image.shape[1], bgr_image.shape[0]),
                    interpolation=cv2.INTER_CUBIC,
                )

        t1 = time.perf_counter()
        return {
            "depth": depth.astype(np.float32),
            "depth_type": self.depth_type,
            "width": int(depth.shape[1]),
            "height": int(depth.shape[0]),
            "timings_ms": {
                "ensure_model_ms": round((t_load - t0) * 1000, 1),
                "inference_ms": round((t1 - t_load) * 1000, 1),
            },
            "runtime": self.runtime_info(),
        }

    @staticmethod
    def _synthetic_depth(bgr: np.ndarray) -> np.ndarray:
        """Planar-ish synthetic relative depth for tests (no fake metres)."""
        h, w = bgr.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        # Larger values nearer bottom-centre (camera looking at ground)
        depth = 1.2 - 0.7 * (yy / max(h - 1, 1)) - 0.15 * np.abs(xx / max(w - 1, 1) - 0.5)
        return depth.astype(np.float32)
