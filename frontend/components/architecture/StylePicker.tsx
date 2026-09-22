"use client";

import { StylePreviewCanvas } from "@/components/architecture/ArchViewer";
import type { ArchStyleCard, LandUnits } from "@/lib/types";
import { formatPkr } from "@/lib/units/land";

export function StylePicker({
  units,
  styles,
  preliminary,
  onSelect,
  onBack,
}: {
  units: LandUnits;
  styles: ArchStyleCard[];
  preliminary?: {
    estimate?: Record<string, string>;
    disclaimer?: string;
  } | null;
  onSelect: (styleId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl bg-ink/95 p-4 text-paper ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-xl">Your plot</p>
          <p className="mt-1 text-brass">{units.display_label}</p>
          <p className="text-xs text-stone">
            {units.sqm.toFixed(1)} m² · {units.marla.toFixed(2)} Marla ·{" "}
            {units.kanal.toFixed(3)} Kanal
          </p>
        </div>
        <button type="button" onClick={onBack} className="text-xs text-brass">
          Remeasure
        </button>
      </div>

      {preliminary?.estimate && (
        <div className="rounded-xl bg-white/5 p-3 text-xs text-stone">
          <p className="font-medium text-paper">Preliminary space estimate</p>
          <p className="mt-1">
            {preliminary.estimate.bedrooms} bedrooms · {preliminary.estimate.bathrooms}{" "}
            bathrooms · kitchen {preliminary.estimate.kitchen} · parking{" "}
            {preliminary.estimate.parking}
          </p>
          <p className="mt-2 text-[11px] opacity-80">{preliminary.disclaimer}</p>
        </div>
      )}

      <div>
        <h2 className="font-serif text-lg">What type of house design do you prefer?</h2>
        <p className="mt-1 text-xs text-stone">
          Choose an architectural style. Designs are filtered by your plot size next.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {styles.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => onSelect(style.id)}
            className="overflow-hidden rounded-2xl bg-white/5 text-left ring-1 ring-white/10 transition hover:ring-brass/60"
          >
            <StylePreviewCanvas styleKey={style.preview_style || style.id} className="h-28 w-full" />
            <div className="space-y-1 p-3">
              <p className="font-medium">{style.name}</p>
              <p className="text-[11px] leading-snug text-stone">{style.description}</p>
              <p className="text-[10px] text-brass/90">{style.traits.slice(0, 3).join(" · ")}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DesignCatalog({
  style,
  units,
  matchKind,
  message,
  designs,
  onSelect,
  onChangeStyle,
  onView,
}: {
  style: string;
  units: LandUnits;
  matchKind: string;
  message?: string | null;
  designs: import("@/lib/types").HouseDesign[];
  onSelect: (id: number) => void;
  onChangeStyle: () => void;
  onView: (id: number) => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl bg-ink/95 p-4 text-paper ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone">{style}</p>
          <h2 className="font-serif text-xl">Compatible designs</h2>
          <p className="text-xs text-stone">Plot {units.display_label}</p>
        </div>
        <button type="button" onClick={onChangeStyle} className="text-xs text-brass">
          Change style
        </button>
      </div>

      {matchKind === "nearby" && (
        <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-100">
          {message ||
            "No exact match for this plot + style. Showing nearby designs for preliminary visualization."}
        </p>
      )}

      {designs.length === 0 && (
        <p className="rounded-xl bg-white/5 p-4 text-sm text-stone">
          No designs found for this style and plot. Change style or remeasure a different area.
        </p>
      )}

      <div className="space-y-3">
        {designs.map((d) => (
          <div
            key={d.id}
            className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10"
          >
            <StylePreviewCanvas
              styleKey={(d.model_config as { style?: string })?.style || d.style}
              className="h-32 w-full"
            />
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{d.name}</p>
                    <span
                      className={
                        (d as { compatibility?: string }).compatibility === "nearby" ||
                        matchKind === "nearby"
                          ? "rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-100"
                          : "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200"
                      }
                    >
                      {(d as { compatibility?: string }).compatibility === "nearby" ||
                      matchKind === "nearby"
                        ? "Nearby only"
                        : "Compatible"}
                    </span>
                  </div>
                  <p className="text-xs text-stone">
                    Plot range{" "}
                    {(d.min_plot_area_sqm ?? d.recommended_min_plot).toFixed(0)}–
                    {(d.max_plot_area_sqm ?? d.recommended_max_plot).toFixed(0)} m² ·
                    footprint{" "}
                    {(
                      d.building_footprint_sqm ??
                      (d.building_width_m || 0) * (d.building_depth_m || 0)
                    ).toFixed(0)}{" "}
                    m² · {d.floors} floors · {d.bedrooms} bed · {d.bathrooms} bath
                  </p>
                  {(d as { match_reason?: string }).match_reason && (
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-[10px] leading-relaxed text-stone">
                      {(d as { match_reason?: string }).match_reason}
                    </pre>
                  )}
                </div>
                <p className="text-sm text-brass">{formatPkr(d.estimated_cost_pkr)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onView(d.id)}
                  className="flex-1 rounded-xl bg-white/10 py-2 text-sm"
                >
                  View 3D
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(d.id)}
                  className="flex-[1.4] rounded-xl bg-brass py-2 text-sm font-medium text-ink"
                >
                  Select design
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
