"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type MeshStandardMaterial,
  type Texture,
} from "three";

import { textureTierForDevice } from "@/lib/render/textureBudget";

const SETS = ["plaster", "roof", "stone", "timber", "paving", "grass"] as const;

type NamedMaterial = MeshStandardMaterial & {
  userData: { canvasMap?: Texture | null; canvasBump?: Texture | null };
};

/** Loads 1K WebP PBR after the first frame. Canvas maps stay until then, and come back if `live` turns off. */
export function Cc0Surfaces({ live }: { live: boolean }) {
  const scene = useThree((state) => state.scene);
  const loadedRef = useRef<Texture[]>([]);
  useEffect(() => {
    const restore = () => {
      scene.traverse((obj) => {
        const material = (obj as { material?: NamedMaterial | NamedMaterial[] }).material;
        const list = Array.isArray(material) ? material : material ? [material] : [];
        list.forEach((entry) => {
          if (!("map" in entry) || entry.userData.canvasMap === undefined) return;
          entry.map = entry.userData.canvasMap;
          entry.bumpMap = entry.userData.canvasBump ?? null;
          entry.normalMap = null;
          entry.roughnessMap = null;
          entry.needsUpdate = true;
        });
      });
    };
    const record = window as Window & { __plotlineTier?: string };
    if (!live) {
      restore();
      loadedRef.current.forEach((map) => map.dispose());
      loadedRef.current = [];
      record.__plotlineTier = "canvas";
      return;
    }
    const tier = textureTierForDevice();
    record.__plotlineTier = "canvas";
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const loader = new TextureLoader();
      const suffix = tier === "webp-512" ? "-512" : "";
      SETS.forEach((name) => {
        const base = `/textures/cc0/${name}`;
        Promise.all([
          loader.loadAsync(`${base}/albedo${suffix}.webp`),
          loader.loadAsync(`${base}/normal${suffix}.webp`),
          loader.loadAsync(`${base}/rough${suffix}.webp`),
        ])
          .then(([albedo, normal, rough]) => {
            if (cancelled) {
              albedo.dispose();
              normal.dispose();
              rough.dispose();
              return;
            }
            loadedRef.current.push(albedo, normal, rough);
            record.__plotlineTier = tier;
            albedo.colorSpace = SRGBColorSpace;
            normal.colorSpace = LinearSRGBColorSpace;
            rough.colorSpace = LinearSRGBColorSpace;
            for (const map of [albedo, normal, rough]) {
              map.wrapS = RepeatWrapping;
              map.wrapT = RepeatWrapping;
              map.repeat.set(1, 1);
              map.anisotropy = 2;
            }
            scene.traverse((obj) => {
              const material = (obj as { material?: NamedMaterial | NamedMaterial[] }).material;
              const list = Array.isArray(material) ? material : material ? [material] : [];
              list.forEach((entry) => {
                if (entry.name !== name || !("map" in entry)) return;
                if (entry.userData.canvasMap === undefined) {
                  entry.userData.canvasMap = entry.map;
                  entry.userData.canvasBump = entry.bumpMap;
                }
                entry.map = albedo;
                entry.bumpMap = null;
                entry.normalMap = normal;
                entry.roughnessMap = rough;
                entry.needsUpdate = true;
              });
            });
          })
          .catch(() => {
            /* Canvas fallback stays. */
          });
      });
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [live, scene]);
  return null;
}
