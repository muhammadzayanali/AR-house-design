"use client";

import { Line } from "@react-three/drei";
import type { WorldPoint } from "@/lib/types";

export function PlotGizmo({ points }: { points: WorldPoint[] }) {
  if (points.length === 0) return null;
  const pts = points.map((p) => [p.x, p.y + 0.02, p.z] as [number, number, number]);
  const closed =
    points.length >= 3
      ? [...pts, pts[0]]
      : pts;

  return (
    <group>
      {points.map((p, i) => (
        <mesh key={`${p.x}-${p.z}-${i}`} position={[p.x, p.y + 0.04, p.z]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color="#d97706" />
        </mesh>
      ))}
      {points.length >= 2 && (
        <Line points={closed} color="#b0893e" lineWidth={2} />
      )}
    </group>
  );
}
