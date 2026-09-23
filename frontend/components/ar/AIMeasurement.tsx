"use client";

/**
 * AI Camera Measurement — browser camera + Django OpenCV/HF depth.
 * Not WebXR / not "full AR". One frame is uploaded only when the user taps Analyze.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { LandUnits, WorldPoint } from "@/lib/types";

export type AiMeasureResult = {
  area_m2: number;
  land_units: LandUnits;
  world_points: WorldPoint[];
  quality: "HIGH" | "MEDIUM" | "LOW" | string;
  calibration_method: string;
  limitations: string[];
};

type DepthAnalyseResponse = {
  success: boolean;
  depth_available: boolean;
  depth_type: string;
  session_id?: string | null;
  width: number;
  height: number;
  quality: string;
  depth_visualization?: string | null;
  visualization?: string | null;
  depth_session?: Record<string, unknown> | null;
  message?: string;
  ground_plane?: { ok: boolean; confidence?: string; reason?: string };
  error?: string;
  user_action?: string | string[];
  timings_ms?: Record<string, number>;
};

type MeasureResponse = {
  success: boolean;
  measurement: {
    area_m2: number;
    area_sqft: number;
    marla: number;
    kanal: number;
    acre: number;
    display_label: string;
  };
  quality: string;
  points: Array<{ image_x: number; image_y: number; world_x: number; world_z: number }>;
  world_points: WorldPoint[];
  calibration: { method: string; known_length_m: number };
  limitations: string[];
  land_units: LandUnits;
  error?: string;
  user_action?: string | string[];
};

type Status =
  | "idle"
  | "camera_ready"
  | "analyzing"
  | "depth_ready"
  | "select_points"
  | "calibrating"
  | "calculated"
  | "error";

type Props = {
  onComplete: (result: AiMeasureResult) => void;
  onCancel: () => void;
  onManualFallback: () => void;
  debug?: boolean;
};

function actionText(action: string | string[] | undefined): string {
  if (!action) return "";
  return Array.isArray(action) ? action.map((a) => `• ${a}`).join("\n") : action;
}

export function AIMeasurement({ onComplete, onCancel, onManualFallback, debug }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [depthViz, setDepthViz] = useState<string | null>(null);
  const [depthSession, setDepthSession] = useState<Record<string, unknown> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quality, setQuality] = useState<string>("");
  const [points, setPoints] = useState<Array<{ image_x: number; image_y: number }>>([]);
  const [frameSize, setFrameSize] = useState({ w: 640, h: 480 });
  const [knownLength, setKnownLength] = useState("2");
  const [refA, setRefA] = useState(0);
  const [refB, setRefB] = useState(1);
  const [result, setResult] = useState<MeasureResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [timings, setTimings] = useState<Record<string, number> | null>(null);
  const [mode, setMode] = useState<"preview" | "depth">("preview");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!window.isSecureContext && location.hostname !== "localhost") {
        setError("Camera needs HTTPS (or localhost). Open the secure site URL.");
        setStatus("error");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("camera_ready");
        setHint(
          "Point the camera toward the plot/ground area. Keep steady. Avoid very dark or heavily occluded scenes.",
        );
      } catch {
        setError(
          "Camera permission denied or unavailable. Enable camera access, or use Manual Measurement.",
        );
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  function captureFrameBlob(): Promise<Blob> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return Promise.reject(new Error("Camera not ready"));
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.reject(new Error("Canvas unavailable"));
    ctx.drawImage(video, 0, 0, w, h);
    setFrameSize({ w, h });
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Failed to capture frame"))),
        "image/jpeg",
        0.85,
      );
    });
  }

  async function analyzeScene() {
    setBusy(true);
    setError(null);
    setStatus("analyzing");
    setResult(null);
    try {
      const blob = await captureFrameBlob();
      const form = new FormData();
      form.append("image", blob, "frame.jpg");
      const data = await api<DepthAnalyseResponse>("/api/vision/depth/?debug=1", {
        method: "POST",
        body: form,
      });
      if (data.timings_ms) setTimings(data.timings_ms);
      if (!data.depth_available) {
        setError(data.error || data.message || "Unable to estimate depth.");
        setHint(actionText(data.user_action) || "Try again or use Manual Measurement.");
        setStatus("error");
        return;
      }
      setDepthViz(data.depth_visualization || data.visualization || null);
      setDepthSession(data.depth_session || null);
      setSessionId(data.session_id || null);
      setQuality(data.quality || data.ground_plane?.confidence || "MEDIUM");
      setMode("depth");
      if (!data.success || data.ground_plane?.ok === false) {
        setError(
          data.message ||
            "AI Camera Measurement could not complete — ground plane unclear.",
        );
        setHint(
          "Try Again · improve lighting · keep steady · or Use Manual Measurement",
        );
        setStatus("error");
        return;
      }
      setPoints([]);
      setStatus("select_points");
      setHint(
        "Tap boundary corners in order (3–8). Then enter a known real-world length between two of those points (tape measure). Relative depth cannot become metres without this calibration.",
      );
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Depth request failed";
      setError(msg);
      setHint("Use Manual Measurement if the vision service is unavailable.");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  function onOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (status !== "select_points" && status !== "calibrating") return;
    if (points.length >= 8) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * frameSize.w;
    const y = ((e.clientY - rect.top) / rect.height) * frameSize.h;
    setPoints((prev) => [...prev, { image_x: x, image_y: y }]);
  }

  async function calculateArea() {
    if (!sessionId && !depthSession) {
      setError("Analyze the scene first.");
      return;
    }
    if (points.length < 3) {
      setError("Add at least 3 boundary points.");
      return;
    }
    const known = Number(knownLength);
    if (!(known > 0)) {
      setError(
        "Metric calibration is required before calculating real-world dimensions from relative depth. Enter a known reference length > 0 metres.",
      );
      return;
    }
    if (refA === refB || refA < 0 || refB < 0 || refA >= points.length || refB >= points.length) {
      setError("Pick two different boundary point indices for calibration.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await api<MeasureResponse>("/api/vision/measure/", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          depth_session: sessionId ? undefined : depthSession,
          points,
          quality,
          calibration: {
            known_length_m: known,
            ref_a_index: refA,
            ref_b_index: refB,
          },
        }),
      });
      if (!data.success) {
        setError(data.error || "AI Camera Measurement could not complete.");
        setHint(actionText(data.user_action));
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("calculated");
      setHint(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Measurement failed";
      setError(msg.includes("calibration") || msg.includes("relative")
        ? msg
        : `AI Camera Measurement could not complete. ${msg}`);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  function resetAll() {
    setPoints([]);
    setDepthSession(null);
    setSessionId(null);
    setDepthViz(null);
    setResult(null);
    setError(null);
    setMode("preview");
    setStatus(streamRef.current ? "camera_ready" : "idle");
    setHint(
      "Point your camera toward the plot or ground area. Keep the phone reasonably stable. Use good lighting. Avoid heavy obstruction.",
    );
  }

  const statusLabel: Record<Status, string> = {
    idle: "Starting camera…",
    camera_ready: "Camera ready",
    analyzing: "Analyzing scene…",
    depth_ready: "Depth estimated",
    select_points: "Select boundary points",
    calibrating: "Set calibration",
    calculated: "Measurement calculated",
    error: "Needs attention",
  };

  return (
    <div className="mx-auto max-w-md space-y-3 rounded-2xl bg-ink/92 p-4 text-paper shadow-xl ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg">AI Camera Measurement</p>
          <p className="text-xs text-stone">{statusLabel[status]}</p>
        </div>
        <button type="button" onClick={onCancel} className="text-xs text-brass">
          Close
        </button>
      </div>

      <p className="text-[11px] leading-snug text-stone/90">
        Uses OpenCV + a free Depth Anything V2 Small model on the server. Metric scale comes from
        your known reference length — not from inventing metres from relative depth. Not survey-grade.
      </p>

      <div
        className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black ring-1 ring-white/10"
        onClick={onOverlayClick}
        role="presentation"
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${mode === "depth" && depthViz ? "opacity-40" : ""}`}
        />
        {mode === "depth" && depthViz ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={depthViz}
            alt="Depth visualisation"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
          />
        ) : null}
        {points.map((p, i) => (
          <span
            key={`${p.image_x}-${p.image_y}-${i}`}
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass ring-2 ring-ink"
            style={{
              left: `${(p.image_x / frameSize.w) * 100}%`,
              top: `${(p.image_y / frameSize.h) * 100}%`,
            }}
            title={`P${i + 1}`}
          />
        ))}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {hint ? <p className="text-[11px] text-stone">{hint}</p> : null}
      {error ? (
        <p className="whitespace-pre-line rounded-xl bg-red-500/15 p-3 text-xs text-red-100" role="alert">
          {error}
        </p>
      ) : null}

      {quality && status !== "camera_ready" && status !== "idle" ? (
        <p className="text-xs text-brass">Measurement Quality: {quality}</p>
      ) : null}

      {debug && timings ? (
        <pre className="overflow-auto rounded bg-black/40 p-2 text-[10px] text-stone">
          {JSON.stringify(timings, null, 2)}
        </pre>
      ) : null}

      {result ? (
        <div className="rounded-xl bg-brass/15 p-3 text-sm">
          <p className="font-serif text-xl text-brass">
            {result.measurement.area_m2.toFixed(1)} m²
          </p>
          <p className="mt-1 text-xs text-stone">
            ≈ {result.measurement.area_sqft.toFixed(1)} sq ft · ≈ {result.measurement.marla.toFixed(2)}{" "}
            Marla · ≈ {result.measurement.kanal.toFixed(3)} Kanal
          </p>
          <p className="mt-2 text-xs">Measurement Quality: {result.quality}</p>
        </div>
      ) : null}

      {(status === "select_points" || status === "calculated" || points.length > 0) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="text-stone">
            Known reference (m)
            <input
              value={knownLength}
              onChange={(e) => setKnownLength(e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-paper"
            />
          </label>
          <div className="grid grid-cols-2 gap-1">
            <label className="text-stone">
              Ref A #
              <input
                type="number"
                min={0}
                max={Math.max(0, points.length - 1)}
                value={refA}
                onChange={(e) => setRefA(Number(e.target.value))}
                className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-paper"
              />
            </label>
            <label className="text-stone">
              Ref B #
              <input
                type="number"
                min={0}
                max={Math.max(0, points.length - 1)}
                value={refB}
                onChange={(e) => setRefB(Number(e.target.value))}
                className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-paper"
              />
            </label>
          </div>
          <p className="col-span-2 text-[10px] text-stone">
            Points: {points.length}/8 — Ref A/B are 0-based indices of boundary taps whose real
            distance equals the known length.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || status === "idle"}
          onClick={() => void analyzeScene()}
          className="rounded-xl bg-brass py-3 text-sm font-medium text-ink disabled:opacity-50"
        >
          {busy && status === "analyzing" ? "Analyzing…" : "Analyze Scene"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPoints((p) => p.slice(0, -1));
          }}
          disabled={points.length === 0}
          className="rounded-xl bg-white/10 py-3 text-sm disabled:opacity-40"
        >
          Undo point
        </button>
        <button
          type="button"
          onClick={resetAll}
          className="rounded-xl bg-white/10 py-3 text-sm"
        >
          Reset
        </button>
        <button
          type="button"
          disabled={busy || points.length < 3 || (!sessionId && !depthSession)}
          onClick={() => void calculateArea()}
          className="rounded-xl bg-paper py-3 text-sm font-medium text-ink disabled:bg-white/10 disabled:text-stone"
        >
          Calculate Area
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
        {result ? (
          <button
            type="button"
            className="w-full rounded-xl bg-brass py-3 text-sm font-medium text-ink"
            onClick={() =>
              onComplete({
                area_m2: result.measurement.area_m2,
                land_units: result.land_units,
                world_points: result.world_points,
                quality: result.quality,
                calibration_method: result.calibration.method,
                limitations: result.limitations,
              })
            }
          >
            Continue to planning
          </button>
        ) : null}
        {status === "error" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void analyzeScene()}
            className="w-full rounded-xl bg-brass/80 py-3 text-sm font-medium text-ink"
          >
            Try Again
          </button>
        ) : null}
        <button
          type="button"
          onClick={onManualFallback}
          className="w-full rounded-xl border border-white/15 py-3 text-sm"
        >
          Use Manual Measurement
        </button>
      </div>
    </div>
  );
}
