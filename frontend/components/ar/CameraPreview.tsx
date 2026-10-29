"use client";

/**
 * Camera-preview placement for phones without WebXR immersive-ar.
 * The camera only rotates (gyro). It does not track walking.
 * Scale stays 1 metre = 1 unit. This is not full AR.
 */

import { Line } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Euler,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
  type Group,
} from "three";

import { HouseRenderer } from "@/components/architecture/ArchViewer";
import { OrientationFilter, requestMotionPermission, screenOrientationAngle } from "@/lib/ar/deviceOrientation";
import { SlamPoseProvider } from "@/lib/ar/poseProvider";
import { visiblePerspective } from "@/lib/ar/previewFov";
import type { HouseDesign, WorldPoint } from "@/lib/types";

const GROUND = new Plane(new Vector3(0, 1, 0), 1.5);
const HIT = new Vector3();
const NDC = new Vector2();
const RAY = new Raycaster();
const LOOK_DOWN = new Quaternion().setFromEuler(new Euler(0.42, 0, 0));

function outlineXZ(points: WorldPoint[], lengthM: number, widthM: number) {
  if (points.length >= 3) {
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cz = points.reduce((s, p) => s + p.z, 0) / points.length;
    const loop = points.map((p) => [p.x - cx, 0.03, p.z - cz] as [number, number, number]);
    loop.push(loop[0]);
    return loop;
  }
  const hx = Math.max(Number(lengthM) || 12, 1) / 2;
  const hz = Math.max(Number(widthM) || 10, 1) / 2;
  return [
    [-hx, 0.03, -hz],
    [hx, 0.03, -hz],
    [hx, 0.03, hz],
    [-hx, 0.03, hz],
    [-hx, 0.03, -hz],
  ] as [number, number, number][];
}

function FovLock({
  video,
  horizontalDeg,
}: {
  video: HTMLVideoElement | null;
  horizontalDeg: number;
}) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const next = visiblePerspective(
      video?.videoWidth || size.width,
      video?.videoHeight || size.height,
      size.width,
      size.height,
      horizontalDeg,
    );
    cam.fov = next.fovDeg;
    cam.aspect = next.aspect;
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height, video, horizontalDeg, video?.videoWidth, video?.videoHeight]);
  return null;
}

function GyroRig({ armed }: { armed: boolean }) {
  const { camera } = useThree();
  const filter = useRef(new OrientationFilter());
  const out = useRef(new Quaternion());
  const sawAbsolute = useRef(false);

  useEffect(() => {
    if (!armed) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const blend = reduced ? 1 : 0.18;
    const apply = (event: DeviceOrientationEvent, absolute: boolean) => {
      if (event.beta == null || event.gamma == null) return;
      // A laptop often emits 0,0,0 with no real sensor. Keep the look-down pose.
      if (!absolute && event.alpha === 0 && event.beta === 0 && event.gamma === 0) return;
      if (absolute) sawAbsolute.current = true;
      if (!absolute && sawAbsolute.current) return;
      filter.current.setReading(event.alpha, event.beta, event.gamma, screenOrientationAngle());
    };
    const onAbs = (event: DeviceOrientationEvent) => apply(event, true);
    const onRel = (event: DeviceOrientationEvent) => apply(event, Boolean(event.absolute));
    window.addEventListener("deviceorientationabsolute", onAbs as EventListener, true);
    window.addEventListener("deviceorientation", onRel, true);
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!filter.current.tick(out.current, blend)) {
        camera.quaternion.copy(LOOK_DOWN);
        return;
      }
      camera.quaternion.copy(out.current);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("deviceorientationabsolute", onAbs as EventListener, true);
      window.removeEventListener("deviceorientation", onRel, true);
    };
  }, [armed, camera]);

  return null;
}

function Brightness({ video, onLevel }: { video: HTMLVideoElement | null; onLevel: (n: number) => void }) {
  const sample = useRef<HTMLCanvasElement | null>(null);
  const n = useRef(0);
  useFrame(() => {
    if (!video || video.readyState < 2) return;
    n.current += 1;
    if (n.current % 20 !== 0) return;
    if (!sample.current) sample.current = document.createElement("canvas");
    const c = sample.current;
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    onLevel(sum / (16 * 16) / 255);
  });
  return null;
}

function PlacedGroup({
  design,
  outline,
  position,
  yaw,
  sun,
}: {
  design: HouseDesign;
  outline: [number, number, number][];
  position: [number, number, number];
  yaw: number;
  sun: number;
}) {
  const ref = useRef<Group>(null);
  return (
    <group ref={ref} position={position} rotation={[0, yaw, 0]}>
      <hemisphereLight args={["#dfe7ef", "#6a6458", 0.45 + sun * 0.35]} />
      <directionalLight
        position={[4, 8, 3]}
        intensity={0.55 + sun * 0.9}
        castShadow
        shadow-mapSize={[512, 512]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <shadowMaterial transparent opacity={0.4} />
      </mesh>
      <Line points={outline} color="#e7c27a" lineWidth={2} />
      <HouseRenderer design={design} arMode />
    </group>
  );
}

export function CameraPreview({
  design,
  points,
  lengthM,
  widthM,
  webxrAvailable,
  onClose,
  onUseWebXR,
}: {
  design: HouseDesign;
  points: WorldPoint[];
  lengthM: string;
  widthM: string;
  webxrAvailable: boolean;
  onClose: () => void;
  onUseWebXR: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<(HTMLCanvasElement & { __camera?: PerspectiveCamera }) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [motion, setMotion] = useState<"needed" | "on" | "denied">("needed");
  const [heightM, setHeightM] = useState(1.5);
  const [hfov, setHfov] = useState(60);
  const [placed, setPlaced] = useState<[number, number, number]>([0, -1.5, -8]);
  const [yaw, setYaw] = useState(0);
  const [notice, setNotice] = useState("");
  const [sun, setSun] = useState(0.55);
  const [experimental, setExperimental] = useState(false);
  const [crop, setCrop] = useState("");
  const slam = useMemo(() => new SlamPoseProvider(), []);
  const outline = useMemo(
    () => outlineXZ(points, Number(lengthM), Number(widthM)),
    [points, lengthM, widthM],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoEl(video);
    let stopped = false;
    let stream: MediaStream | null = null;
    if (!window.isSecureContext) {
      setStreamError("Camera preview needs HTTPS.");
      return;
    }
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((next) => {
        if (stopped) {
          next.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = next;
        video.srcObject = next;
        const facing = next.getVideoTracks()[0]?.getSettings?.().facingMode;
        if (facing === "user") {
          setNotice(
            `${design.name} is shown at real size. This browser opened the front camera, so you see yourself. On a phone, choose the rear camera and look at the floor.`,
          );
        }
        void video.play().catch(() => setStreamError("The camera did not start."));
      })
      .catch(() => setStreamError("Camera permission was denied."));
    const onMeta = () => {
      const box = video.getBoundingClientRect();
      const vis = visiblePerspective(video.videoWidth, video.videoHeight, box.width, box.height, hfov);
      setCrop(
        `Visible ${Math.round(vis.visibleNativeWidth)}×${Math.round(vis.visibleNativeHeight)} of ${video.videoWidth}×${video.videoHeight} px`,
      );
    };
    video.addEventListener("loadedmetadata", onMeta);
    return () => {
      stopped = true;
      video.removeEventListener("loadedmetadata", onMeta);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    setPlaced((current) => [current[0], -heightM, current[2]]);
  }, [heightM]);

  useEffect(() => {
    setNotice(
      `${design.name} is in front of the camera at real size. Drag it to move it. On a computer this picture is your webcam, not the floor.`,
    );
  }, [design.name]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let last = 0;
    let twisting = false;
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        twisting = false;
        return;
      }
      event.preventDefault();
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const ang = Math.atan2(dy, dx);
      if (twisting) {
        let delta = ang - last;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        setYaw((y) => y + delta);
      }
      last = ang;
      twisting = true;
    };
    const end = () => {
      twisting = false;
    };
    root.addEventListener("touchmove", move, { passive: false });
    root.addEventListener("touchend", end);
    return () => {
      root.removeEventListener("touchmove", move);
      root.removeEventListener("touchend", end);
    };
  }, []);

  useEffect(() => {
    const ios = typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    if (!ios) setMotion("on");
  }, []);

  function hitFromEvent(event: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cam = canvas.__camera;
    if (!cam) return null;
    const rect = canvas.getBoundingClientRect();
    NDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    NDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    RAY.setFromCamera(NDC, cam);
    if (RAY.ray.direction.y >= -0.05) return "horizon" as const;
    GROUND.constant = heightM;
    const hit = RAY.ray.intersectPlane(GROUND, HIT);
    if (!hit) return null;
    return [hit.x, hit.y, hit.z] as [number, number, number];
  }

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 bg-black text-paper">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <Canvas
        className="absolute inset-0"
        shadows
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, 0], fov: 70, near: 0.05, far: 80 }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          const dom = gl.domElement as HTMLCanvasElement & { __camera?: PerspectiveCamera };
          dom.__camera = camera as PerspectiveCamera;
          canvasRef.current = dom;
        }}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, moved: false };
        }}
        onPointerMove={(event) => {
          if (!drag.current || !placed) return;
          if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) < 12) return;
          drag.current.moved = true;
          const hit = hitFromEvent(event);
          if (hit && hit !== "horizon") setPlaced(hit);
        }}
        onPointerUp={(event) => {
          const moved = drag.current?.moved;
          drag.current = null;
          if (moved) return;
          const hit = hitFromEvent(event);
          if (hit === "horizon") {
            setNotice("Look down at the ground, then tap. Taps above the horizon are ignored.");
            return;
          }
          if (!hit) {
            setNotice("Could not find the ground from that tap.");
            return;
          }
          setPlaced(hit);
          setNotice("Placed. Drag to move. Twist to rotate. Scale stays 1:1.");
        }}
      >
        <FovLock video={videoEl} horizontalDeg={hfov} />
        <GyroRig armed={motion === "on"} />
        <Brightness video={videoEl} onLevel={setSun} />
        <PlacedGroup design={design} outline={outline} position={placed} yaw={yaw} sun={sun} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="rounded-full bg-black/70 px-3 py-2 text-xs">Camera preview — approximate placement</p>
            <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-black/70 px-4 text-sm">
              Close
            </button>
          </div>
          <p className="max-w-sm rounded-xl bg-black/60 px-3 py-2 text-xs leading-snug">
            Stand still and turn to look around. Walking moves the house.
          </p>
          <p className="text-[11px] text-white/80">{notice}</p>
          {crop ? <p className="text-[11px] text-white/70">{crop}</p> : null}
          {streamError ? <p className="text-xs text-amber-200">{streamError}</p> : null}
          {experimental ? (
            <p className="max-w-sm rounded-xl bg-amber-500/20 px-3 py-2 text-xs leading-snug text-amber-50">
              {slam.reason}
            </p>
          ) : null}
        </div>

        <div className="pointer-events-auto space-y-2 rounded-2xl bg-black/75 p-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-2 text-xs text-ink">Active: Camera preview</span>
            {webxrAvailable ? (
              <button type="button" onClick={onUseWebXR} className="min-h-11 rounded-full bg-white/15 px-3 text-xs">
                Switch to WebXR
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setExperimental((v) => !v)}
              className={`min-h-11 rounded-full px-3 text-xs ${experimental ? "bg-amber-200 text-ink" : "bg-white/15"}`}
            >
              Experimental
            </button>
          </div>
          {motion === "needed" ? (
            <button
              type="button"
              className="min-h-11 w-full rounded-xl bg-brass text-sm font-medium text-ink"
              onClick={() => {
                void requestMotionPermission().then((result) => setMotion(result === "denied" ? "denied" : "on"));
              }}
            >
              Enable motion
            </button>
          ) : null}
          {motion === "denied" ? (
            <p className="text-xs text-amber-100">Motion permission was denied. Placement still works, but turning will not.</p>
          ) : null}
          <label className="flex items-center justify-between gap-3 text-xs">
            Phone height {heightM.toFixed(2)} m
            <input
              type="range"
              min={0.8}
              max={2.2}
              step={0.05}
              value={heightM}
              onChange={(e) => setHeightM(Number(e.target.value))}
              className="w-40"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs">
            Horizontal FOV {hfov.toFixed(0)}°
            <input
              type="range"
              min={40}
              max={90}
              step={1}
              value={hfov}
              onChange={(e) => setHfov(Number(e.target.value))}
              className="w-40"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs">
            Twist {Math.round((yaw * 180) / Math.PI)}°
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={Math.round((yaw * 180) / Math.PI)}
              onChange={(e) => setYaw((Number(e.target.value) * Math.PI) / 180)}
              className="w-40"
            />
          </label>
          <button
            type="button"
            onClick={() => {
            setPlaced([0, -heightM, -8]);
            setYaw(0);
            setNotice(`${design.name} is back in front of the camera.`);
            }}
            className="min-h-11 w-full rounded-xl bg-white/15 text-sm"
          >
            Reset / Re-place
          </button>
        </div>
      </div>
    </div>
  );
}
