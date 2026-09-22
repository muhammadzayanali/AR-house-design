"use client";

import {
  Center,
  ContactShadows,
  Environment,
  OrbitControls,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo, useState } from "react";

import { HouseModel } from "@/components/ar/HouseModel";
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

export function HouseRenderer({
  design,
  evening = false,
}: {
  design: HouseDesign;
  evening?: boolean;
}) {
  const useGlb =
    design.model_type === "glb" && Boolean(design.glb_url || design.model_url);
  const config = useMemo(() => configFromDesign(design), [design]);

  if (useGlb) {
    const url = design.model_url || design.glb_url;
    return <HouseModel url={url!} />;
  }

  return <ArchitecturalHouse config={config} evening={evening} />;
}

function SceneLights({ evening }: { evening: boolean }) {
  return (
    <>
      <ambientLight intensity={evening ? 0.22 : 0.38} />
      <hemisphereLight
        args={[evening ? "#1a2230" : "#eef3f8", "#4a5a40", evening ? 0.25 : 0.55]}
      />
      <directionalLight
        castShadow
        position={[14, 22, 10]}
        intensity={evening ? 0.4 : 1.55}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-8, 10, -6]} intensity={evening ? 0.15 : 0.35} color="#b8c8e0" />
    </>
  );
}

export function ArchViewer({
  design,
  className,
  showControls = true,
}: {
  design: HouseDesign;
  className?: string;
  showControls?: boolean;
}) {
  const [evening, setEvening] = useState(false);
  const w = design.building_width_m || 12;
  const camDist = Math.max(16, w * 1.45);

  return (
    <div
      className={
        className ?? "relative h-[420px] w-full overflow-hidden rounded-2xl bg-ink"
      }
    >
      {showControls && (
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          <button
            type="button"
            onClick={() => setEvening((v) => !v)}
            className="rounded-full bg-black/55 px-3 py-1.5 text-xs text-paper backdrop-blur"
          >
            {evening ? "Day light" : "Evening"}
          </button>
        </div>
      )}
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{
          position: [camDist * 0.75, camDist * 0.38, camDist * 0.9],
          fov: 36,
          near: 0.1,
          far: 200,
        }}
        gl={{ antialias: true, toneMappingExposure: evening ? 0.85 : 1.05 }}
      >
        <color attach="background" args={[evening ? "#0c1018" : "#b9c7d4"]} />
        <fog attach="fog" args={[evening ? "#0c1018" : "#b9c7d4", 35, 85]} />
        <SceneLights evening={evening} />
        <Suspense fallback={null}>
          <Center top>
            <HouseRenderer design={design} evening={evening} />
          </Center>
          <ContactShadows
            position={[0, 0.02, 0]}
            opacity={0.55}
            scale={48}
            blur={2.4}
            far={24}
          />
          {!evening && <Environment preset="warehouse" />}
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan
          maxPolarAngle={Math.PI / 2.08}
          minDistance={8}
          maxDistance={48}
          target={[0, 2.2, 0]}
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
    <div className={className ?? "h-36 w-full overflow-hidden rounded-xl bg-[#1a222c]"}>
      <Canvas shadows camera={{ position: [13, 7, 15], fov: 38 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#1a222c"]} />
        <ambientLight intensity={0.55} />
        <directionalLight castShadow position={[10, 14, 8]} intensity={1.35} />
        <Suspense fallback={null}>
          <Center>
            <HouseRenderer design={design} />
          </Center>
          <ContactShadows opacity={0.4} scale={30} blur={2} far={16} />
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
