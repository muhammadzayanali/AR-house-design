"use client";

/**
 * WebXR-anchored house placement.
 * Creates a persistent XRAnchor at placement time and re-applies its pose
 * every frame via useApplyXRSpaceMatrix — do NOT derive pose from depth/ML.
 */

import { useApplyXRSpaceMatrix, useRequestXRAnchor, useXR } from "@react-three/xr";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Quaternion, Vector3 } from "three";

import { HouseRenderer } from "@/components/architecture/ArchViewer";
import { footprintFromWorldPolygon } from "@/lib/geometry/displayToImage";
import type { HouseDesign, WorldPoint } from "@/lib/types";

type Props = {
  design: HouseDesign;
  /** One-shot hit position used only to create the anchor (not for tracking). */
  placeAt: WorldPoint;
  /** Measured plot polygon in metres (XZ) — drives footprint scale/orient. */
  plotPoints: WorldPoint[];
};

export function AnchoredHouse({ design, placeAt, plotPoints }: Props) {
  const groupRef = useRef<Group>(null);
  const requestAnchor = useRequestXRAnchor();
  const session = useXR((s) => s.session);
  const anchorRef = useRef<XRAnchor | null>(null);
  const [anchorSpace, setAnchorSpace] = useState<XRSpace | undefined>(undefined);

  const footprint = useMemo(() => {
    if (plotPoints.length >= 3) {
      return footprintFromWorldPolygon(plotPoints);
    }
    return {
      width: design.building_width_m || 10,
      depth: design.building_depth_m || 10,
      yaw: 0,
      centerX: 0,
      centerZ: 0,
    };
  }, [plotPoints, design.building_width_m, design.building_depth_m]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!session) return;
      try {
        try {
          anchorRef.current?.delete?.();
        } catch {
          /* ignore */
        }
        const anchor = await requestAnchor({
          relativeTo: "world",
          worldPosition: new Vector3(placeAt.x, placeAt.y, placeAt.z),
          worldQuaternion: new Quaternion(),
        });
        if (cancelled) {
          anchor?.delete?.();
          return;
        }
        if (!anchor) {
          setAnchorSpace(undefined);
          if (groupRef.current) {
            groupRef.current.position.set(placeAt.x, placeAt.y, placeAt.z);
            groupRef.current.quaternion.identity();
          }
          return;
        }
        anchorRef.current = anchor;
        setAnchorSpace(anchor.anchorSpace);
      } catch {
        setAnchorSpace(undefined);
        if (groupRef.current) {
          groupRef.current.position.set(placeAt.x, placeAt.y, placeAt.z);
          groupRef.current.quaternion.identity();
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        anchorRef.current?.delete?.();
      } catch {
        /* ignore */
      }
      anchorRef.current = null;
    };
  }, [session, placeAt.x, placeAt.y, placeAt.z, requestAnchor]);

  useApplyXRSpaceMatrix(groupRef, anchorSpace);

  return (
    <group ref={groupRef} matrixAutoUpdate={!anchorSpace}>
      <group rotation={[0, -footprint.yaw, 0]}>
        {/* Soft ground catcher — grounds the house on the real surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
          <planeGeometry args={[Math.max(24, footprint.width * 2.5), Math.max(24, footprint.depth * 2.5)]} />
          <shadowMaterial transparent opacity={0.32} />
        </mesh>
        {/* Measured plot guide */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <planeGeometry args={[footprint.width, footprint.depth]} />
          <meshBasicMaterial color="#b0893e" transparent opacity={0.18} />
        </mesh>
        <HouseRenderer
          design={design}
          footprintOverride={{ width: footprint.width, depth: footprint.depth }}
          arMode
        />
      </group>
      {/* Minimal AR lighting helpers (session already lit by XR; this fills gaps) */}
      <hemisphereLight args={["#e8eef5", "#5a5a50", 0.35]} />
      <directionalLight position={[2, 6, 1]} intensity={0.55} castShadow={false} />
    </group>
  );
}
