"use client";

import { useMemo } from "react";
import { MeshPhysicalMaterial, MeshStandardMaterial } from "three";

import { grassMap, plasterMaps, roofTileMap, stonePaveMap } from "./surfaceTextures";

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

export function useArchMaterials(
  style: string,
  evening: boolean,
  opts?: { mobileGlass?: boolean },
) {
  const mobileGlass = opts?.mobileGlass !== false;
  return useMemo(() => {
    const s = style.toLowerCase();
    const american = s.includes("american");
    const wallHex = s.includes("italian")
      ? "#e6d0b0"
      : s.includes("cottage")
        ? "#c9a87a"
        : s.includes("traditional")
          ? "#f0e8da"
          : american
            ? "#f4f5f6"
            : s.includes("luxury")
              ? "#ece6dc"
              : "#ebe8e2";
    const wallMaps = plasterMaps(wallHex);
    const wall = new MeshStandardMaterial({
      name: "plaster",
      // American siding stays a gray even after the pale plaster photo replaces the canvas.
      color: american ? "#7d8b98" : "#ffffff",
      map: wallMaps.map,
      bumpMap: wallMaps.bump,
      bumpScale: 0.035,
      roughness: s.includes("italian") ? 0.92 : 0.78,
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

    const pitched =
      s.includes("italian") ||
      s.includes("cottage") ||
      s.includes("traditional") ||
      s.includes("american");
    const roof = new MeshStandardMaterial({
      name: "roof",
      color: pitched ? "#ffffff" : "#34383e",
      map: pitched ? roofTileMap() : null,
      roughness: 0.9,
      metalness: 0.04,
    });

    const glass = new MeshPhysicalMaterial(
      mobileGlass
        ? {
            color: evening ? "#f3dfb8" : american ? "#4e6c84" : "#a8c4d4",
            transparent: true,
            opacity: evening ? 0.5 : american ? 0.82 : 0.45,
            roughness: 0.08,
            metalness: 0.1,
            envMapIntensity: 1.25,
            depthWrite: false,
            emissive: evening ? "#ffc888" : "#000000",
            emissiveIntensity: evening ? 0.28 : 0,
          }
        : {
            color: evening ? "#f3dfb8" : american ? "#4e6c84" : "#9ebcd0",
            transmission: evening ? 0.12 : 0.55,
            transparent: true,
            opacity: evening ? 0.9 : 0.55,
            roughness: 0.08,
            metalness: 0.15,
            thickness: 0.35,
            envMapIntensity: 1.2,
            emissive: evening ? "#ffc888" : "#000000",
            emissiveIntensity: evening ? 0.65 : 0,
          },
    );

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
      name: "grass",
      color: "#ffffff",
      map: grassMap(),
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
      name: "paving",
      color: "#ffffff",
      map: stonePaveMap(),
      roughness: 0.95,
      metalness: 0,
    });

    return { wall, accent, roof, glass, trim, dark, grass, water, pave };
  }, [style, evening, mobileGlass]);
}
