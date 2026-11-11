"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { ArchViewer } from "@/components/architecture/ArchViewer";
import catalog from "@/lib/houses/manifest.json";
import type { HouseDesign } from "@/lib/types";

type Row = {
  name: string;
  style: string;
  footprint_m: { width: number; depth: number };
  height_m: number;
  floors: number;
  bedrooms: number;
};

function designFrom(name: string): HouseDesign {
  const rows = (catalog as { models: Row[] }).models;
  const row = rows.find((item) => item.name === name) ?? rows[0];
  return {
    id: 0,
    name: row.name,
    style: row.style,
    description: "",
    glb_url: "",
    model_type: "procedural",
    recommended_min_plot: 0,
    recommended_max_plot: 0,
    building_width_m: row.footprint_m.width,
    building_depth_m: row.footprint_m.depth,
    building_height_m: row.height_m,
    floors: row.floors,
    bedrooms: row.bedrooms,
    parking: false,
    estimated_cost_pkr: 0,
    balconies: row.style.includes("Italian") ? 1 : 0,
    terraces: 1,
    source_license: "project-generated",
    source_provider: "plotline-procedural",
  };
}

function MassingShot() {
  const params = useSearchParams();
  const name = params.get("name") || "Italian Compact Villa";
  const evening = params.get("evening") === "1";
  return (
    <main className="h-dvh w-screen bg-ink">
      <ArchViewer
        design={designFrom(name)}
        className="h-full w-full"
        showControls
        evening={evening}
      />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MassingShot />
    </Suspense>
  );
}
