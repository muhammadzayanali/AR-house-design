"use client";

import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useMemo, type ReactNode } from "react";

function LoadedModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={scene} />;
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <mesh>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#b0893e" wireframe />
          </mesh>
        )
      );
    }
    return this.props.children;
  }
}

export function HouseModel({ url }: { url: string }) {
  return (
    <ModelErrorBoundary>
      <Suspense fallback={null}>
        <LoadedModel url={url} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

if (typeof window !== "undefined") {
  useGLTF.preload("/models/compact-cottage.glb?v=3");
  useGLTF.preload("/models/modern-family.glb?v=3");
  useGLTF.preload("/models/italian-villa.glb?v=3");
}
