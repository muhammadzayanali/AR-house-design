"use client";

import dynamic from "next/dynamic";

const ARExperience = dynamic(() => import("@/components/ar/ARExperience"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-paper">
      <p className="text-lg">Loading planner…</p>
      <p className="max-w-sm text-sm text-stone">
        First phone load can take a few seconds. Use{" "}
        <code className="text-brass">http://192.168.1.140:3000</code> on the same
        Wi‑Fi, then hard-refresh if this hangs.
      </p>
    </div>
  ),
});

export default function ARPage() {
  return <ARExperience />;
}
