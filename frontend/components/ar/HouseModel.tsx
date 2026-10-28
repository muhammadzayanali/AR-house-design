"use client";

/**
 * Optimized GLB house loader — Draco/meshopt when present, lazy, disposeful.
 * Units: metres. Origin: footprint centre, y=0. No placeholder boxes in production UI.
 */

import { useGLTF, useProgress } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  Box3,
  Mesh,
  Object3D,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Texture,
} from "three";
// Self-hosted Draco decoder (copied under public/draco/gltf/)
useGLTF.setDecoderPath("/draco/gltf/");

function disposeObject(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        const mat = m as Material & Record<string, Texture | undefined>;
        for (const key of Object.keys(mat)) {
          const val = mat[key];
          if (val && typeof val === "object" && "isTexture" in val) {
            (val as Texture).dispose();
          }
        }
        m.dispose();
      }
    }
  });
}

function LoadedModel({
  url,
  onBounds,
}: {
  url: string;
  onBounds?: (size: Vector3) => void;
}) {
  // true, true → Draco + meshopt when present in the GLB
  const gltf = useGLTF(url, true, true);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const groupRef = useRef<Object3D>(null);

  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        const anyM = m as Material & {
          map?: Texture;
          emissiveMap?: Texture;
          colorSpace?: string;
        };
        if (anyM.map) anyM.map.colorSpace = SRGBColorSpace;
        if (anyM.emissiveMap) anyM.emissiveMap.colorSpace = SRGBColorSpace;
        m.needsUpdate = true;
      }
    });
    const box = new Box3().setFromObject(scene);
    const size = new Vector3();
    box.getSize(size);
    onBounds?.(size);
    return () => {
      disposeObject(scene);
    };
  }, [scene, onBounds]);

  return <primitive ref={groupRef} object={scene} />;
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

export function ModelLoadProgress({ className }: { className?: string }) {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div
      className={
        className ??
        "pointer-events-none absolute inset-x-0 bottom-4 z-10 mx-auto w-48 rounded-full bg-black/50 px-3 py-2 text-center text-[11px] text-paper backdrop-blur"
      }
      role="status"
    >
      Loading model… {Math.round(progress)}%
    </div>
  );
}

export function HouseModel({
  url,
  onBounds,
  fallback,
}: {
  url: string;
  onBounds?: (size: Vector3) => void;
  fallback?: ReactNode;
}) {
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <LoadedModel url={url} onBounds={onBounds} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

/** Soft ground catcher for AR / viewer (ShadowMaterial). */
export function GroundShadowCatcher({ size = 40 }: { size?: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = -Math.PI / 2;
  });
  return (
    <mesh ref={ref} position={[0, 0.001, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <shadowMaterial transparent opacity={0.35} />
    </mesh>
  );
}
