"use client";

import { useEffect, type RefObject } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BufferGeometry, Matrix4, Mesh, type Group, type Material } from "three";

/** One draw per material for the static house. Transparent and opaque batches stay separate. */
export function MergeStatic({ target }: { target: RefObject<Group | null> }) {
  useEffect(() => {
    const root = target.current;
    if (!root || root.userData.merged) return;
    root.userData.merged = true;
    root.updateWorldMatrix(true, true);
    const inverse = new Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map<string, { material: Material; geos: BufferGeometry[]; meshes: Mesh[] }>();

    root.traverse((obj) => {
      if (!(obj instanceof Mesh) || !obj.geometry) return;
      const material = obj.material;
      if (!material || Array.isArray(material)) return;
      if (material.type === "ShadowMaterial" || material.type === "ShaderMaterial") return;
      const geometry = obj.geometry.clone();
      geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse, obj.matrixWorld));
      const signature = Object.keys(geometry.attributes).sort().join(",");
      const key = `${material.uuid}:${signature}`;
      const bucket = buckets.get(key) ?? {
        material,
        geos: [] as BufferGeometry[],
        meshes: [] as Mesh[],
      };
      bucket.geos.push(geometry);
      bucket.meshes.push(obj);
      buckets.set(key, bucket);
    });

    buckets.forEach((bucket) => {
      if (bucket.meshes.length < 2) {
        bucket.geos.forEach((geometry) => geometry.dispose());
        return;
      }
      const merged = mergeGeometries(bucket.geos, false);
      bucket.geos.forEach((geometry) => geometry.dispose());
      if (!merged) return;
      const mesh = new Mesh(merged, bucket.material);
      mesh.castShadow = bucket.meshes.some((item) => item.castShadow);
      mesh.receiveShadow = bucket.meshes.some((item) => item.receiveShadow);
      mesh.userData.mergedMesh = true;
      root.add(mesh);
      bucket.meshes.forEach((item) => {
        item.parent?.remove(item);
        item.geometry.dispose();
      });
    });
  }, [target]);
  return null;
}
