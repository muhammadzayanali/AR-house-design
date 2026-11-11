"use client";

import { useEffect, useState } from "react";

import { detectImmersiveAR } from "@/lib/xr/support";
import { TEXTURE_TIER_MB } from "@/lib/render/textureBudget";

type RenderInfo = {
  calls: number;
  triangles: number;
  textures: number;
  geometries: number;
  dpr: number;
  textureMB: number;
  textureTier: string;
};

type CameraInfo = {
  facingMode?: string;
  orientationFiring?: boolean;
  tapToPlace?: boolean;
};

function shortAgent(agent: string) {
  return agent.replace(/\(.*?\)/g, "(…)").slice(0, 96);
}

export function DebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [fps, setFps] = useState({ avg: 0, min: 0 });
  const [render, setRender] = useState<RenderInfo | null>(null);
  const [xr, setXr] = useState("…");
  const [orientation, setOrientation] = useState(false);
  const [facing, setFacing] = useState("(not reported)");
  const [copied, setCopied] = useState(false);
  const [agent, setAgent] = useState("");

  useEffect(() => {
    const on = new URLSearchParams(window.location.search).get("debug") === "1";
    setEnabled(on);
    if (!on) return;
    setAgent(navigator.userAgent);
    void detectImmersiveAR().then((status) => setXr(status.kind === "supported" ? "true" : "false"));
    const samples: Array<{ t: number; fps: number }> = [];
    let last = performance.now();
    let posted = 0;
    let raf = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (dt > 0 && dt < 250) samples.push({ t: now, fps: 1000 / dt });
      const cutoff = now - 5000;
      while (samples.length && samples[0].t < cutoff) samples.shift();
      if (now - posted > 250 && samples.length) {
        posted = now;
        const avg = samples.reduce((sum, sample) => sum + sample.fps, 0) / samples.length;
        setFps({ avg: Math.round(avg), min: Math.round(Math.min(...samples.map((sample) => sample.fps))) });
        const next = (window as Window & { __plotlineRender?: RenderInfo }).__plotlineRender;
        if (next) setRender(next);
        const camera = (window as Window & { __plotlineCamera?: CameraInfo }).__plotlineCamera;
        if (camera?.facingMode) setFacing(camera.facingMode);
        if (camera?.orientationFiring) setOrientation(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onOrient = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      if (event.alpha === 0 && event.beta === 0 && event.gamma === 0) return;
      setOrientation(true);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  if (!enabled) return null;

  const tier = render?.textureTier ?? "canvas";
  const lines = [
    `fps avg ${fps.avg}  min ${fps.min}  (last 5 s)`,
    `devicePixelRatio ${window.devicePixelRatio}  renderer ${render?.dpr ?? "—"}`,
    `draws ${render?.calls ?? "—"}  triangles ${render?.triangles ?? "—"}`,
    `textures ${render?.textures ?? "—"}  geometries ${render?.geometries ?? "—"}`,
    `texture tier ${tier}`,
    `texture GPU ${render?.textureMB?.toFixed(1) ?? "—"} MB live`,
    `1K tier estimate ${TEXTURE_TIER_MB["webp-1k"].toFixed(1)} MB`,
    `512 tier estimate ${TEXTURE_TIER_MB["webp-512"].toFixed(1)} MB`,
    `WebXR immersive-ar ${xr}`,
    `facingMode ${facing}`,
    `deviceorientation ${orientation ? "firing" : "not firing"}`,
    `ua ${shortAgent(agent)}`,
  ];

  return (
    <aside className="fixed bottom-3 left-3 z-[80] max-w-[min(92vw,28rem)] rounded-xl bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-paper">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
      <button
        type="button"
        className="mt-2 min-h-11 rounded-full bg-white px-3 text-xs text-ink"
        onClick={() => {
          const report = lines.join("\n");
          void navigator.clipboard.writeText(report).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied" : "Copy report"}
      </button>
    </aside>
  );
}
