"use client";

import { useMemo } from "react";
import { MeshPhysicalMaterial, MeshStandardMaterial } from "three";

export type ArchStyle =
  | "modern"
  | "italian"
  | "american"
  | "cottage"
  | "contemporary"
  | "traditional"
  | "luxury";

export type HouseFeatures = {
  balcony?: boolean;
  garage?: boolean;
  pool?: boolean;
  terrace?: boolean;
  cantilever?: boolean;
  columns?: boolean;
  arches?: boolean;
  porch?: boolean;
  lighting?: boolean;
};

export type HouseConfig = {
  style: ArchStyle | string;
  floors: number;
  footprint: { width: number; depth: number };
  features?: HouseFeatures;
};

export function useArchMaterials(style: string, evening: boolean) {
  return useMemo(() => {
    const s = style.toLowerCase();
    const wall = new MeshStandardMaterial({
      color: s.includes("italian")
        ? "#e6d0b0"
        : s.includes("cottage")
          ? "#c9a87a"
          : s.includes("traditional")
            ? "#f0e8da"
            : s.includes("american")
              ? "#dce3e9"
              : s.includes("luxury")
                ? "#ece6dc"
                : "#ebe8e2",
      roughness: s.includes("italian") ? 0.92 : 0.72,
      metalness: 0.04,
    });

    const accent = new MeshStandardMaterial({
      color:
        s.includes("modern") || s.includes("contemporary") || s.includes("luxury")
          ? "#2c3036"
          : "#8f877a",
      roughness: 0.7,
      metalness: 0.08,
    });

    const roof = new MeshStandardMaterial({
      color:
        s.includes("italian") ||
        s.includes("cottage") ||
        s.includes("traditional") ||
        s.includes("american")
          ? "#8a3d28"
          : "#34383e",
      roughness: 0.88,
      metalness: 0.06,
    });

    const glass = new MeshPhysicalMaterial({
      color: evening ? "#f3dfb8" : "#9ebcd0",
      transmission: evening ? 0.12 : 0.55,
      transparent: true,
      opacity: evening ? 0.9 : 0.55,
      roughness: 0.08,
      metalness: 0.15,
      thickness: 0.35,
      envMapIntensity: 1.2,
      emissive: evening ? "#ffc888" : "#000000",
      emissiveIntensity: evening ? 0.65 : 0,
    });

    const trim = new MeshStandardMaterial({
      color: "#f4f0e8",
      roughness: 0.62,
      metalness: 0.05,
    });
    const dark = new MeshStandardMaterial({
      color: "#1c1713",
      roughness: 0.55,
      metalness: 0.12,
    });
    const grass = new MeshStandardMaterial({
      color: "#4f7344",
      roughness: 1,
      metalness: 0,
    });
    const water = new MeshPhysicalMaterial({
      color: "#2b7294",
      transmission: 0.45,
      transparent: true,
      opacity: 0.78,
      roughness: 0.12,
      metalness: 0.18,
    });
    const pave = new MeshStandardMaterial({
      color: "#b9b2a6",
      roughness: 0.95,
      metalness: 0,
    });

    return { wall, accent, roof, glass, trim, dark, grass, water, pave };
  }, [style, evening]);
}
