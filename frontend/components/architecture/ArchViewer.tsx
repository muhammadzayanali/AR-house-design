"use client";

import {
  ContactShadows,
  Environment,
  OrbitControls,
} from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace, Vector3 } from "three";
import { Suspense, useEffect, useMemo, useState } from "react";

import { HouseModel, ModelLoadProgress } from "@/components/ar/HouseModel";
import type { HouseDesign } from "@/lib/types";

import { ArchitecturalHouse } from "./ArchitecturalHouse";
import type { HouseConfig } from "./materials";

function configFromDesign(design: HouseDesign): HouseConfig {
  const cfg = (design.model_config || {}) as HouseConfig;
  return {
    style: cfg.style || design.style || "modern",
    floors: cfg.floors || design.floors || 2,
    footprint: cfg.footprint || {
      width: design.building_width_m || 10,
      depth: design.building_depth_m || 10,
    },
    features: {
      balcony: cfg.features?.balcony ?? (design.balconies || 0) > 0,
      garage: cfg.features?.garage ?? Boolean(design.garage),
      pool: cfg.features?.pool ?? Boolean(design.pool),
      terrace: cfg.features?.terrace ?? (design.terraces || 0) > 0,
      cantilever: cfg.features?.cantilever,
      columns: cfg.features?.columns,
      arches: cfg.features?.arches,
      porch: cfg.features?.porch,
      lighting: cfg.features?.lighting,
    },
  };
}

function isMobileClient() {
  if (typeof navigator === "undefined") return true;
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

export function HouseRenderer({
  design,
  evening = false,
  footprintOverride,
  arMode = false,
  plotPolygon,
}: {
  design: HouseDesign;
  evening?: boolean;
  footprintOverride?: { width: number; depth: number };
  arMode?: boolean;
  plotPolygon?: Array<{ x: number; z: number }>;
}) {
  const useGlb =
    design.model_type === "glb" && Boolean(design.glb_url || design.model_url);
  const mobile = useMemo(() => isMobileClient(), []);
  const config = useMemo(() => {
    const base = configFromDesign(design);
    if (!footprintOverride) return base;
    return {
      ...base,
      footprint: {
        width: Math.max(0.5, footprintOverride.width),
        depth: Math.max(0.5, footprintOverride.depth),
      },
    };
  }, [design, footprintOverride]);

  if (useGlb) {
    const url = design.model_url || design.glb_url;
    const nativeW = design.model_width_m || design.building_width_m || 10;
    const nativeD = design.model_depth_m || design.building_depth_m || 10;
    const sx = footprintOverride ? footprintOverride.width / nativeW : 1;
    const sz = footprintOverride ? footprintOverride.depth / nativeD : 1;
    return (
      <group scale={[sx, Math.min(sx, sz), sz]}>
        <HouseModel
          url={url!}
          fallback={
            <ArchitecturalHouse
              config={config}
              evening={evening}
              mobileGlass={mobile || arMode}
              plotPolygon={plotPolygon}
            />
          }
        />
      </group>
    );
  }

  return (
    <ArchitecturalHouse
      config={config}
      evening={evening}
      mobileGlass={mobile || arMode}
      plotPolygon={plotPolygon}
    />
  );
}

function ColorManagement({ evening }: { evening: boolean }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = evening ? 0.85 : 1.05;
  }, [gl, evening]);
  return null;
}

function FitCamera({ widthM, depthM, heightM }: { widthM: number; depthM: number; heightM: number }) {
  const { camera, controls, size } = useThree() as {
    camera: { position: Vector3; lookAt: (x: number, y: number, z: number) => void; updateProjectionMatrix: () => void };
    controls?: { target: Vector3; update: () => void } | null;
    size: { width: number; height: number };
  };
  useEffect(() => {
    const span = Math.max(widthM, depthM, heightM, 8);
    const aspect = size.height > 0 ? size.width / size.height : 1;
    // Portrait canvases need more distance so the facade stays inside the frame.
    const dist = Math.max(18, span * (aspect < 1 ? 2.35 : 1.7));
    const elev = dist * Math.sin((16 * Math.PI) / 180);
    const horiz = dist * Math.cos((16 * Math.PI) / 180);
    camera.position.set(horiz * 0.78, elev + 1.2, horiz * 0.7);
    const ty = Math.min(heightM * 0.32, 2.2);
    if (controls?.target) {
      controls.target.set(0, ty, 0);
      controls.update();
    } else {
      camera.lookAt(0, ty, 0);
    }
    camera.updateProjectionMatrix();
  }, [camera, controls, widthM, depthM, heightM, size.width, size.height]);
  return null;
}

/** Keep the model in the strip above a bottom sheet. */
function ViewInset({ bottomPx }: { bottomPx: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    if (bottomPx < 8) {
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
      return;
    }
    const visible = Math.max(120, size.height - bottomPx);
    cam.setViewOffset(size.width, size.height, 0, 0, size.width, visible);
    cam.updateProjectionMatrix();
    return () => {
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
    };
  }, [camera, size.width, size.height, bottomPx]);
  return null;
}

function SceneLights({ evening, desktopShadows }: { evening: boolean; desktopShadows: boolean }) {
  return (
    <>
      <ambientLight intensity={evening ? 0.22 : 0.4} />
      <hemisphereLight
        args={[evening ? "#1a2230" : "#eef3f8", "#5a6a50", evening ? 0.28 : 0.55]}
      />
      <directionalLight
        castShadow={desktopShadows}
        position={[14, 22, 10]}
        intensity={evening ? 0.45 : 1.45}
        shadow-mapSize={desktopShadows ? [1024, 1024] : [512, 512]}
        shadow-camera-far={60}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-8, 10, -6]} intensity={evening ? 0.15 : 0.32} color="#b8c8e0" />
    </>
  );
}

export function ArchViewer({
  design,
  className,
  showControls = true,
  footprintOverride,
  evening: eveningProp,
  onEveningChange,
  viewInsetBottom = 0,
  plotPolygon,
}: {
  design: HouseDesign;
  className?: string;
  showControls?: boolean;
  footprintOverride?: { width: number; depth: number };
  evening?: boolean;
  onEveningChange?: (next: boolean) => void;
  /** Pixels covered by a bottom sheet — model is recentred above it. */
  viewInsetBottom?: number;
  plotPolygon?: Array<{ x: number; z: number }>;
}) {
  const [eveningLocal, setEveningLocal] = useState(false);
  const evening = eveningProp ?? eveningLocal;
  const setEvening = (next: boolean) => {
    if (onEveningChange) onEveningChange(next);
    else setEveningLocal(next);
  };
  const mobile = useMemo(() => isMobileClient(), []);
  const w = footprintOverride?.width || design.building_width_m || 12;
  const d = footprintOverride?.depth || design.building_depth_m || 10;
  const h = design.building_height_m || 8;
  const generated =
    design.model_type !== "glb" ||
    design.source_provider === "plotline-procedural" ||
    (design.source_license || "").includes("project-generated");

  return (
    <div
      className={
        className ?? "relative h-[420px] w-full overflow-hidden rounded-2xl bg-ink"
      }
    >
      {showControls && (
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
          {!onEveningChange ? (
            <button
              type="button"
              onClick={() => setEvening(!evening)}
              className="min-h-11 rounded-full bg-black/55 px-3 py-2 text-xs text-paper backdrop-blur"
            >
              {evening ? "Day light" : "Evening"}
            </button>
          ) : null}
          {generated ? (
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] text-stone backdrop-blur">
              Generated massing model
            </span>
          ) : null}
        </div>
      )}
      <ModelLoadProgress enabled={!generated} />
      <Canvas
        shadows={!mobile}
        dpr={[1, mobile ? 1.5 : 2]}
        camera={{
          position: [w * 1.2, h * 0.55, d * 1.35],
          fov: 38,
          near: 0.15,
          far: 220,
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <ColorManagement evening={evening} />
        <color attach="background" args={[evening ? "#2a2622" : "#5c6166"]} />
        <fog attach="fog" args={[evening ? "#2a2622" : "#5c6166", 55, 140]} />
        <ViewInset bottomPx={viewInsetBottom} />
        <SceneLights evening={evening} desktopShadows={!mobile} />
        <Suspense fallback={null}>
          <HouseRenderer
            design={design}
            evening={evening}
            footprintOverride={footprintOverride}
            plotPolygon={plotPolygon}
          />
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={evening ? 0.62 : 0.45}
            scale={Math.max(28, w * 3)}
            blur={2.4}
            far={22}
          />
          <FitCamera widthM={w} depthM={d} heightM={h} />
        </Suspense>
        <Suspense fallback={null}>
          <Environment
            preset={evening ? "sunset" : "city"}
            environmentIntensity={evening ? 0.55 : 0.85}
          />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan
          maxPolarAngle={Math.PI / 2.05}
          minPolarAngle={0.12}
          minDistance={Math.max(6, Math.min(w, d) * 0.6)}
          maxDistance={Math.max(36, w * 4)}
          target={[0, Math.min(h * 0.4, 3), 0]}
        />
      </Canvas>
    </div>
  );
}

export function StylePreviewCanvas({
  styleKey,
  className,
}: {
  styleKey: string;
  className?: string;
}) {
  const key = styleKey.toLowerCase();
  const style =
    key.includes("italian")
      ? "italian"
      : key.includes("cottage")
        ? "cottage"
        : key.includes("american")
          ? "american"
          : key.includes("traditional")
            ? "traditional"
            : key.includes("luxury")
              ? "luxury"
              : key.includes("contemporary")
                ? "contemporary"
                : "modern";

  const design: HouseDesign = {
    id: 0,
    name: styleKey,
    style: styleKey,
    description: "",
    glb_url: "",
    recommended_min_plot: 100,
    recommended_max_plot: 200,
    bedrooms: 3,
    bathrooms: 2,
    floors: 2,
    parking: true,
    estimated_cost_pkr: 0,
    model_type: "procedural",
    building_width_m: 11,
    building_depth_m: 9.5,
    building_height_m: 7.5,
    source_provider: "plotline-procedural",
    source_license: "project-generated",
    model_config: {
      style,
      floors: 2,
      footprint: { width: 11, depth: 9.5 },
      features: {
        balcony: true,
        garage: style === "american" || style === "luxury" || style === "modern",
        pool: style === "luxury",
        terrace: true,
        columns: style === "italian" || style === "traditional",
        porch: style === "american" || style === "cottage",
        cantilever: style === "modern" || style === "luxury" || style === "contemporary",
      },
    },
  };

  return (
    <div className={className ?? "relative h-36 w-full overflow-hidden rounded-xl bg-[#1a222c]"}>
      <span className="absolute left-2 top-2 z-10 rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-stone">
        Generated massing
      </span>
      <Canvas shadows={false} camera={{ position: [13, 7, 15], fov: 38 }} dpr={[1, 1.35]}>
        <color attach="background" args={["#1a222c"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 14, 8]} intensity={1.25} />
        <Suspense fallback={null}>
          <HouseRenderer design={design} />
          <ContactShadows opacity={0.35} scale={30} blur={2} far={16} />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.55}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
    </div>
  );
}
