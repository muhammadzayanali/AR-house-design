"use client";

import { Center, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { HouseModel } from "@/components/ar/HouseModel";
import { ArchViewer } from "@/components/architecture/ArchViewer";
import type { HouseDesign } from "@/lib/types";

export function ModelViewer({
  glbUrl,
  design,
  className,
}: {
  glbUrl?: string;
  design?: HouseDesign;
  className?: string;
}) {
  if (design) {
    return <ArchViewer design={design} className={className} />;
  }

  if (!glbUrl) {
    return (
      <div
        className={
          className ??
          "flex h-[420px] w-full items-center justify-center rounded-2xl bg-ink text-sm text-stone"
        }
      >
        No model available
      </div>
    );
  }

  return (
    <div className={className ?? "h-[420px] w-full overflow-hidden rounded-2xl bg-ink"}>
      <Canvas camera={{ position: [16, 11, 20], fov: 40 }} gl={{ antialias: true }}>
        <color attach="background" args={["#1c1916"]} />
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#f4efe6", "#3f3a34", 0.55]} />
        <directionalLight position={[10, 18, 8]} intensity={1.35} />
        <Center>
          <HouseModel url={glbUrl} />
        </Center>
        <OrbitControls makeDefault enablePan />
      </Canvas>
    </div>
  );
}
