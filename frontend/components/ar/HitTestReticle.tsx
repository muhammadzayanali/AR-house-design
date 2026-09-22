"use client";

import { useXRHitTest } from "@react-three/xr";
import { useRef, type MutableRefObject } from "react";
import { Matrix4, Mesh, Quaternion, Vector3 } from "three";

const matrix = new Matrix4();
const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();

type Props = {
  hitRef: MutableRefObject<Vector3 | null>;
  visible?: boolean;
};

export function HitTestReticle({ hitRef, visible = true }: Props) {
  const meshRef = useRef<Mesh>(null);

  useXRHitTest((results, getWorldMatrix) => {
    if (!results.length) {
      hitRef.current = null;
      return;
    }
    getWorldMatrix(matrix, results[0]);
    matrix.decompose(position, quaternion, scale);
    hitRef.current = position.clone();
    if (meshRef.current) {
      meshRef.current.position.copy(position);
      meshRef.current.quaternion.copy(quaternion);
    }
  }, "viewer");

  return (
    <mesh ref={meshRef} visible={visible} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.1, 0.16, 48]} />
      <meshBasicMaterial color="#b0893e" transparent opacity={0.95} />
    </mesh>
  );
}
