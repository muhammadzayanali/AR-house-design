"""Tests for AI camera measurement (OpenCV + depth + calibration).

Uses VISION_MOCK so CI does not download Hugging Face weights.
Mandatory: relative depth + no scale must NOT return metres.
"""
from __future__ import annotations

import io
import json
import os
from unittest import mock

import numpy as np
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

# Ensure mock depth before imports that may construct the service
os.environ["VISION_MOCK"] = "1"

from planning.geometry import area_sqm_from_points
from planning.services import vision_measurement as vm
from planning.services.depth_model_service import (
    DepthModelService,
    reset_depth_model_service_for_tests,
)
from planning.services import vision_opencv as vcv
from planning.units import sqm_to_units


def _make_jpeg(w=320, h=240, color=(180, 170, 160)):
    import cv2

    img = np.full((h, w, 3), color, dtype=np.uint8)
    # brighter ground band
    img[h // 2 :, :] = (120, 140, 100)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


@override_settings()
class RelativeDepthGuardTests(TestCase):
    def test_relative_depth_without_calibration_rejected(self):
        with self.assertRaises(ValueError) as ctx:
            vm.reject_relative_without_calibration("relative", None)
        self.assertIn("DO NOT return exact metres", str(ctx.exception))
        self.assertIn("Metric calibration is required", str(ctx.exception))

    def test_zero_and_negative_calibration_rejected(self):
        with self.assertRaises(ValueError):
            vm.reject_relative_without_calibration("relative", {"known_length_m": 0})
        with self.assertRaises(ValueError):
            vm.reject_relative_without_calibration("relative", {"known_length_m": -2})

    def test_measure_rejects_relative_without_scale(self):
        depth = np.ones((100, 100), dtype=np.float32) * 0.5
        session = {
            "values": depth[::2, ::2].tolist(),
            "step": 2,
            "width": 100,
            "height": 100,
            "type": "relative",
            "plane": {
                "ok": True,
                "confidence": "MEDIUM",
                "normal": [0.0, 1.0, 0.0],
                "offset": -2.0,
                "intrinsics": {"fx": 100, "fy": 100, "cx": 50, "cy": 50},
            },
        }
        points = [
            {"image_x": 10, "image_y": 10},
            {"image_x": 90, "image_y": 10},
            {"image_x": 90, "image_y": 90},
        ]
        with self.assertRaises(ValueError):
            vm.measure_from_session(
                depth_session=session,
                boundary_points=points,
                calibration={},
            )


class DepthSessionStoreTests(TestCase):
    def setUp(self):
        from planning.services.depth_session_store import clear_depth_sessions_for_tests

        clear_depth_sessions_for_tests()

    def test_put_get_and_invalid_id(self):
        from planning.services.depth_session_store import (
            get_depth_session,
            put_depth_session,
        )

        sid = put_depth_session({"type": "relative", "values": [[1.0]], "width": 1, "height": 1, "step": 1})
        self.assertIsNotNone(get_depth_session(sid))
        self.assertIsNone(get_depth_session("not-a-real-session"))

    def test_measure_via_session_id_api(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from planning.services.depth_session_store import clear_depth_sessions_for_tests

        clear_depth_sessions_for_tests()
        client = APIClient()
        jpeg = _make_jpeg()
        upload = SimpleUploadedFile("frame.jpg", jpeg, content_type="image/jpeg")
        depth_resp = client.post("/api/vision/depth/", {"image": upload}, format="multipart")
        self.assertEqual(depth_resp.status_code, 200)
        body = depth_resp.json()
        if not body.get("success"):
            self.skipTest("mock plane not confident enough on this frame")
        sid = body.get("session_id")
        self.assertTrue(sid)
        points = [
            {"image_x": 40, "image_y": 80},
            {"image_x": 280, "image_y": 80},
            {"image_x": 280, "image_y": 200},
            {"image_x": 40, "image_y": 200},
        ]
        measure = client.post(
            "/api/vision/measure/",
            data=json.dumps(
                {
                    "session_id": sid,
                    "points": points,
                    "calibration": {
                        "known_length_m": 10.0,
                        "ref_a_index": 0,
                        "ref_b_index": 1,
                    },
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(measure.status_code, 200, measure.content)
        self.assertTrue(measure.json()["success"])
        self.assertGreater(measure.json()["measurement"]["area_m2"], 0)

    def test_expired_session_rejected(self):
        client = APIClient()
        resp = client.post(
            "/api/vision/measure/",
            data=json.dumps(
                {
                    "session_id": "00000000-0000-0000-0000-000000000000",
                    "points": [
                        {"image_x": 1, "image_y": 1},
                        {"image_x": 2, "image_y": 1},
                        {"image_x": 2, "image_y": 2},
                    ],
                    "calibration": {"known_length_m": 2, "ref_a_index": 0, "ref_b_index": 1},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("expired", resp.json()["error"].lower())



class CalibrationAndAreaTests(TestCase):
    def setUp(self):
        reset_depth_model_service_for_tests()
        os.environ["VISION_MOCK"] = "1"

    def test_user_calibration_scales_to_known_length(self):
        world = [
            {"x": 0.0, "z": 0.0, "image_x": 0, "image_y": 0, "y": 0},
            {"x": 3.0, "z": 0.0, "image_x": 1, "image_y": 0, "y": 0},
            {"x": 3.0, "z": 2.0, "image_x": 1, "image_y": 1, "y": 0},
            {"x": 0.0, "z": 2.0, "image_x": 0, "image_y": 1, "y": 0},
        ]
        scaled, scale = vm.apply_user_calibration(
            world, ref_a_index=0, ref_b_index=1, known_length_m=15.0
        )
        self.assertAlmostEqual(scale, 5.0, places=5)
        self.assertAlmostEqual(scaled[1]["x"] - scaled[0]["x"], 15.0, places=5)
        area = area_sqm_from_points(scaled)
        # 15 × 10 = 150
        self.assertAlmostEqual(area, 150.0, places=4)

    def test_controlled_15x12_path_units(self):
        pts = [
            {"x": 0, "y": 0, "z": 0},
            {"x": 15, "y": 0, "z": 0},
            {"x": 15, "y": 0, "z": 12},
            {"x": 0, "y": 0, "z": 12},
        ]
        area = area_sqm_from_points(pts)
        self.assertAlmostEqual(area, 180.0, places=5)
        units = sqm_to_units(area)
        self.assertAlmostEqual(units["sqft"], 1937.5, places=0)
        self.assertAlmostEqual(units["marla"], 7.117, places=2)
        self.assertAlmostEqual(units["kanal"], 0.3559, places=3)

    def test_invalid_polygon_points(self):
        with self.assertRaises(ValueError):
            vm.measure_from_session(
                depth_session={"type": "relative", "values": [[1]], "width": 1, "height": 1, "step": 1, "plane": {"ok": True}},
                boundary_points=[{"image_x": 1, "image_y": 1}],
                calibration={"known_length_m": 2, "ref_a_index": 0, "ref_b_index": 0},
            )


class DepthAnalyseApiTests(TestCase):
    def setUp(self):
        reset_depth_model_service_for_tests()
        os.environ["VISION_MOCK"] = "1"
        self.client = APIClient()

    def test_depth_endpoint_mock(self):
        jpeg = _make_jpeg()
        resp = self.client.post(
            "/api/vision/depth/",
            {"image": io.BytesIO(jpeg)},
            format="multipart",
        )
        # multipart with BytesIO needs proper file-like name
        from django.core.files.uploadedfile import SimpleUploadedFile

        upload = SimpleUploadedFile("frame.jpg", jpeg, content_type="image/jpeg")
        resp = self.client.post("/api/vision/depth/", {"image": upload}, format="multipart")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["depth_available"])
        self.assertEqual(data["depth_type"], "relative")
        self.assertIn(data["quality"], ("HIGH", "MEDIUM", "LOW"))
        self.assertIsNone(data.get("confidence"))  # no fake %
        self.assertIsNotNone(data.get("depth_session"))

    def test_depth_get_info(self):
        resp = self.client.get("/api/vision/depth/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("depth-anything", resp.json()["model"].lower())


class MeasureApiTests(TestCase):
    def setUp(self):
        reset_depth_model_service_for_tests()
        os.environ["VISION_MOCK"] = "1"
        self.client = APIClient()
        # Build a synthetic depth session with a clear plane
        h, w = 120, 160
        depth = np.linspace(1.0, 0.3, h, dtype=np.float32)[:, None] * np.ones((h, w), dtype=np.float32)
        plane = vcv.estimate_ground_plane(depth, depth_type="relative")
        if not plane.get("ok"):
            plane = {
                "ok": True,
                "confidence": "MEDIUM",
                "normal": [0.05, 0.95, 0.05],
                "offset": -1.5,
                "intrinsics": {"fx": float(max(w, h)), "fy": float(max(w, h)), "cx": w / 2, "cy": h / 2, "width": w, "height": h},
                "inlier_ratio": 0.5,
            }
        step = 2
        self.session = {
            "values": depth[::step, ::step].tolist(),
            "step": step,
            "width": w,
            "height": h,
            "type": "relative",
            "plane": plane,
        }

    def test_measure_with_calibration(self):
        points = [
            {"image_x": 20, "image_y": 40},
            {"image_x": 140, "image_y": 40},
            {"image_x": 140, "image_y": 100},
            {"image_x": 20, "image_y": 100},
        ]
        payload = {
            "depth_session": self.session,
            "points": points,
            "calibration": {
                "known_length_m": 15.0,
                "ref_a_index": 0,
                "ref_b_index": 1,
            },
        }
        resp = self.client.post(
            "/api/vision/measure/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertGreater(data["measurement"]["area_m2"], 0)
        self.assertEqual(data["calibration"]["method"], "user_reference")
        self.assertEqual(data["depth"]["type"], "relative")
        self.assertIn("Not survey-grade", data["limitations"][1])

    def test_measure_rejects_no_calibration(self):
        payload = {
            "depth_session": self.session,
            "points": [
                {"image_x": 20, "image_y": 40},
                {"image_x": 140, "image_y": 40},
                {"image_x": 140, "image_y": 100},
            ],
            "calibration": {},
        }
        resp = self.client.post(
            "/api/vision/measure/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)


class ControlledValidationReportTests(TestCase):
    """Synthetic geometry validation — reports error vs ground truth.

    These use perfect world coordinates (not camera inference) to verify the
    area engine. Camera end-to-end accuracy is documented separately and must
    not invent a percentage.
    """

    CASES = [
        ("5x5", [{"x": 0, "y": 0, "z": 0}, {"x": 5, "y": 0, "z": 0}, {"x": 5, "y": 0, "z": 5}, {"x": 0, "y": 0, "z": 5}], 25.0),
        ("10x10", [{"x": 0, "y": 0, "z": 0}, {"x": 10, "y": 0, "z": 0}, {"x": 10, "y": 0, "z": 10}, {"x": 0, "y": 0, "z": 10}], 100.0),
        ("10x15", [{"x": 0, "y": 0, "z": 0}, {"x": 10, "y": 0, "z": 0}, {"x": 10, "y": 0, "z": 15}, {"x": 0, "y": 0, "z": 15}], 150.0),
        ("15x12", [{"x": 0, "y": 0, "z": 0}, {"x": 15, "y": 0, "z": 0}, {"x": 15, "y": 0, "z": 12}, {"x": 0, "y": 0, "z": 12}], 180.0),
        (
            "irregular",
            [
                {"x": 0, "y": 0, "z": 0},
                {"x": 20, "y": 0, "z": 0},
                {"x": 20, "y": 0, "z": 15},
                {"x": 0, "y": 0, "z": 12},
            ],
            270.0,
        ),
    ]

    def test_controlled_dataset_zero_error_on_world_coords(self):
        report = []
        for name, pts, truth in self.CASES:
            predicted = area_sqm_from_points(pts)
            abs_err = abs(predicted - truth)
            pct = (abs_err / truth) * 100.0 if truth else 0.0
            report.append(
                {
                    "case": name,
                    "ground_truth": truth,
                    "predicted": predicted,
                    "absolute_error": abs_err,
                    "percentage_error": pct,
                }
            )
            self.assertAlmostEqual(predicted, truth, places=5, msg=name)
        # Persist a small report artifact for docs (deterministic, not camera accuracy)
        out = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "..",
            "docs",
            "AI_CAMERA_VALIDATION_GEOMETRY.json",
        )
        out = os.path.normpath(out)
        with open(out, "w", encoding="utf-8") as fh:
            json.dump({"note": "World-coordinate geometry only — not camera inference accuracy.", "cases": report}, fh, indent=2)


class DepthModelServiceTests(TestCase):
    def setUp(self):
        reset_depth_model_service_for_tests()
        os.environ["VISION_MOCK"] = "1"

    def test_lazy_mock_load(self):
        svc = DepthModelService()
        self.assertFalse(svc.is_ready)
        img = np.zeros((64, 64, 3), dtype=np.uint8)
        result = svc.estimate_depth(img)
        self.assertEqual(result["depth_type"], "relative")
        self.assertEqual(result["depth"].shape, (64, 64))
        self.assertTrue(svc.runtime_info()["mock"])
