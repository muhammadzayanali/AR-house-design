"""AI camera measurement API views.

POST /api/vision/depth/   — one frame → depth + plane quality (no continuous upload)
POST /api/vision/measure/ — depth session + points + calibration → area m²
"""
from __future__ import annotations

import base64
import json

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import vision_measurement as vm
from .services.depth_model_service import get_depth_model_service
from .services.vision_opencv import OpenCVUnavailable


def _image_bytes_from_request(request) -> bytes:
    upload = request.FILES.get("image") or request.FILES.get("frame")
    if upload is not None:
        data = upload.read()
        if not data:
            raise ValueError("Empty image upload.")
        if len(data) > 8 * 1024 * 1024:
            raise ValueError("Image too large (max 8 MB).")
        return data

    payload = request.data
    b64 = payload.get("image_base64") or payload.get("frame_base64")
    if b64:
        raw = str(b64)
        if "," in raw and raw.strip().startswith("data:"):
            raw = raw.split(",", 1)[1]
        try:
            data = base64.b64decode(raw, validate=False)
        except Exception as exc:
            raise ValueError("Invalid image_base64.") from exc
        if len(data) > 8 * 1024 * 1024:
            raise ValueError("Image too large (max 8 MB).")
        return data

    raise ValueError(
        "Provide a camera frame as multipart `image` or JSON `image_base64`."
    )


class VisionDepthView(APIView):
    """Analyze a single captured frame — OpenCV preprocess + HF depth model."""

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        svc = get_depth_model_service()
        return Response(
            {
                "ok": True,
                "feature": "ai_camera_measurement",
                "model": svc.model_id,
                "depth_type": svc.depth_type,
                "runtime": svc.runtime_info(),
                "note": (
                    "Relative depth requires user calibration for metres. "
                    "Frames are processed in memory and not stored."
                ),
            }
        )

    def post(self, request):
        try:
            image_bytes = _image_bytes_from_request(request)
            result = vm.analyse_frame(image_bytes)
            # Drop runtime details from normal success payload for clarity;
            # keep timings for debug when ?debug=1
            if request.query_params.get("debug") != "1":
                result.pop("runtime", None)
            return Response(result, status=status.HTTP_200_OK)
        except OpenCVUnavailable as exc:
            return Response(
                {
                    "success": False,
                    "depth_available": False,
                    "error": str(exc),
                    "user_action": "Use Manual Measurement, or install OpenCV on the server.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except ValueError as exc:
            return Response(
                {
                    "success": False,
                    "depth_available": False,
                    "error": str(exc),
                    "user_action": (
                        "Capture a clearer JPEG frame, or use Manual Measurement."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {
                    "success": False,
                    "depth_available": False,
                    "error": "Depth estimation failed: {0}".format(exc),
                    "user_action": [
                        "Move to a brighter location",
                        "Keep the camera steady",
                        "Show more of the ground",
                        "Use the manual measurement option",
                    ],
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class VisionMeasureView(APIView):
    """Convert boundary taps + calibration + depth session → plot area."""

    permission_classes = [AllowAny]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        try:
            data = request.data
            if isinstance(data.get("depth_session"), str):
                depth_session = json.loads(data["depth_session"])
            else:
                depth_session = data.get("depth_session")
            if isinstance(data.get("points"), str):
                points = json.loads(data["points"])
            else:
                points = data.get("points") or data.get("boundary_points")
            if isinstance(data.get("calibration"), str):
                calibration = json.loads(data["calibration"])
            else:
                calibration = data.get("calibration") or {}

            session_id = data.get("session_id") or (
                depth_session.get("session_id") if isinstance(depth_session, dict) else None
            )
            if session_id and (not depth_session or "values" not in (depth_session or {})):
                from .services.depth_session_store import get_depth_session

                stored = get_depth_session(str(session_id))
                if stored is None:
                    return Response(
                        {
                            "success": False,
                            "error": (
                                "Invalid or expired depth session. "
                                "Analyze the scene again."
                            ),
                            "user_action": [
                                "Tap Analyze Scene again",
                                "Or use Manual Measurement",
                            ],
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                depth_session = stored

            depth_type = (depth_session or {}).get("type") or "relative"
            vm.reject_relative_without_calibration(depth_type, calibration)

            result = vm.measure_from_session(
                depth_session=depth_session or {},
                boundary_points=points or [],
                calibration=calibration,
                quality_hint=data.get("quality"),
            )
            result["measurement_method"] = "ai_camera"
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as exc:
            msg = str(exc)
            actions = [
                "Re-select boundary points in order around the plot",
                "Provide a known reference length in metres",
                "Analyze the scene again",
                "Or use Manual Measurement (length × width)",
            ]
            if "calibration" in msg.lower() or "relative depth" in msg.lower():
                actions = [
                    "Add Calibration — enter a known real-world length between two points",
                    "Use Manual Measurement",
                ]
            return Response(
                {
                    "success": False,
                    "error": msg,
                    "user_action": actions,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {
                    "success": False,
                    "error": "Measurement failed: {0}".format(exc),
                    "user_action": "Try again or use Manual Measurement.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
