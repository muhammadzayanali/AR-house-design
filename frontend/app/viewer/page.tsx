"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ModelViewer } from "@/components/viewer/ModelViewer";

function ViewerInner() {
  const params = useSearchParams();
  const url = params.get("glb") || "/models/italian-villa.glb?v=3";
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="font-serif text-3xl">3D viewer</h1>
      <p className="mt-2 text-sm text-muted">
        Mediterranean villa massing (columns, pediment, arched openings). Drag to orbit.
      </p>
      <div className="mt-6">
        <ModelViewer glbUrl={url} className="h-[70vh] w-full overflow-hidden rounded-3xl bg-ink" />
      </div>
    </main>
  );
}

export default function ViewerPage() {
  return (
    <Suspense>
      <ViewerInner />
    </Suspense>
  );
}
