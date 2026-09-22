"use client";

import type { ReactNode } from "react";
import { StylePreviewCanvas } from "@/components/architecture/ArchViewer";
import type { ArchStyleCard, HouseDesign, LandUnits } from "@/lib/types";
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
    <div className="mx-auto max-w-lg space-y-5 rounded-2xl bg-ink/95 p-4 text-paper shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-brass">
            Step 1 · Style
          </p>
          <h2 className="mt-1 font-serif text-2xl leading-tight">Your plot</h2>
          <p className="mt-1 text-lg text-brass">{units.display_label}</p>
          <p className="mt-0.5 text-xs text-stone">
            {units.sqm.toFixed(1)} m² · {units.marla.toFixed(2)} Marla
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs text-brass ring-1 ring-brass/40 transition hover:bg-brass/10"
        >
          Remeasure
        </button>
      </header>

      {preliminary?.estimate && (
        <div className="rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-3.5 ring-1 ring-white/10">
          <p className="text-sm font-medium text-paper">Rough space estimate</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip>{preliminary.estimate.bedrooms} beds</Chip>
            <Chip>{preliminary.estimate.bathrooms} baths</Chip>
            <Chip>Kitchen {preliminary.estimate.kitchen}</Chip>
            <Chip>Parking {preliminary.estimate.parking}</Chip>
          </div>
          {preliminary.disclaimer && (
            <p className="mt-2 text-[11px] leading-snug text-stone/90">
              {preliminary.disclaimer}
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="font-serif text-xl leading-snug">
          What house style do you prefer?
        </h3>
        <p className="mt-1 text-sm text-stone">
          Pick a look. We’ll filter designs that fit this plot next.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {styles.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => onSelect(style.id)}
            className="group overflow-hidden rounded-2xl bg-white/[0.04] text-left ring-1 ring-white/10 transition duration-200 hover:bg-white/[0.07] hover:ring-brass/50 active:scale-[0.99]"
          >
            <StylePreviewCanvas
              styleKey={style.preview_style || style.id}
              className="h-32 w-full transition duration-300 group-hover:brightness-110"
            />
            <div className="space-y-1.5 p-3.5">
              <p className="font-medium tracking-tight">{style.name}</p>
              <p className="text-xs leading-snug text-stone">{style.description}</p>
              <p className="text-[11px] text-brass/90">
                {style.traits.slice(0, 3).join(" · ")}
              </p>
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
  designs: HouseDesign[];
  onSelect: (id: number) => void;
  onChangeStyle: () => void;
  onView: (id: number) => void;
}) {
  const nearby =
    matchKind === "nearby" ||
    designs.some((d) => d.compatibility === "nearby");

  return (
    <div className="mx-auto max-w-lg space-y-5 rounded-2xl bg-ink/95 p-4 text-paper shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-brass">
            Step 2 · Designs · {style}
          </p>
          <h2 className="mt-1 font-serif text-2xl leading-tight">
            Designs for your plot
          </h2>
          <p className="mt-1 text-sm text-stone">
            {units.display_label}
            <span className="text-stone/70"> · {units.sqm.toFixed(0)} m²</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onChangeStyle}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs text-brass ring-1 ring-brass/40 transition hover:bg-brass/10"
        >
          Change style
        </button>
      </header>

      {nearby && (
        <div className="rounded-2xl bg-amber-500/10 px-3.5 py-3 text-sm leading-snug text-amber-50 ring-1 ring-amber-400/25">
          {message ||
            "No exact catalog hit for this plot + style. Showing the closest fits for a preliminary look."}
        </div>
      )}

      {designs.length === 0 && (
        <div className="rounded-2xl bg-white/5 px-4 py-6 text-center">
          <p className="font-serif text-lg">No designs in this style</p>
          <p className="mt-1 text-sm text-stone">
            Try another style or remeasure a different plot area.
          </p>
          <button
            type="button"
            onClick={onChangeStyle}
            className="mt-4 rounded-xl bg-brass px-4 py-2.5 text-sm font-medium text-ink"
          >
            Change style
          </button>
        </div>
      )}

      <div className="space-y-4">
        {designs.map((d) => (
          <DesignCard
            key={d.id}
            design={d}
            units={units}
            catalogNearby={nearby}
            onView={() => onView(d.id)}
            onSelect={() => onSelect(d.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DesignCard({
  design: d,
  units,
  catalogNearby,
  onView,
  onSelect,
}: {
  design: HouseDesign;
  units: LandUnits;
  catalogNearby: boolean;
  onView: () => void;
  onSelect: () => void;
}) {
  const isNearby = d.compatibility === "nearby" || catalogNearby;
  const lo = d.min_plot_area_sqm ?? d.recommended_min_plot;
  const hi = d.max_plot_area_sqm ?? d.recommended_max_plot;
  const foot =
    d.building_footprint_sqm ??
    (d.building_width_m || 0) * (d.building_depth_m || 0);
  const openArea = Math.max(0, units.sqm - foot);
  const coverage = units.sqm > 0 ? (foot / units.sqm) * 100 : 0;
  const styleKey =
    (d.model_config as { style?: string } | undefined)?.style || d.style;

  return (
    <article className="overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
      <div className="relative">
        <StylePreviewCanvas styleKey={styleKey} className="h-40 w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/80 to-transparent" />
        <span
          className={
            isNearby
              ? "absolute left-3 top-3 rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-medium text-ink"
              : "absolute left-3 top-3 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-medium text-ink"
          }
        >
          {isNearby ? "Closest fit" : "Fits your plot"}
        </span>
      </div>

      <div className="space-y-3.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl leading-tight">{d.name}</h3>
            <p className="mt-0.5 text-xs capitalize text-stone">{d.style} style</p>
          </div>
          <p className="shrink-0 text-right text-sm font-medium text-brass">
            {formatPkr(d.estimated_cost_pkr)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip>
            {lo.toFixed(0)}–{hi.toFixed(0)} m² range
          </Chip>
          <Chip>{foot.toFixed(0)} m² footprint</Chip>
          <Chip>{d.floors} floors</Chip>
          <Chip>
            {d.bedrooms} bed · {d.bathrooms ?? "—"} bath
          </Chip>
        </div>

        <div className="rounded-xl bg-black/25 p-3 ring-1 ring-white/5">
          <p className="text-xs font-medium text-paper">Why this design</p>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5">
            <Fact label="Your plot" value={`${units.sqm.toFixed(0)} m²`} />
            <Fact label="Fits range" value={`${lo.toFixed(0)}–${hi.toFixed(0)} m²`} />
            <Fact
              label="Building size"
              value={`${(d.building_width_m ?? 0).toFixed(0)}×${(d.building_depth_m ?? 0).toFixed(0)} m`}
            />
            <Fact label="Open area left" value={`${openArea.toFixed(0)} m²`} />
            <Fact label="Coverage" value={`${coverage.toFixed(0)}%`} />
            <Fact label="Match type" value={isNearby ? "Nearby" : "Exact"} />
          </dl>
          <p className="mt-2.5 text-[11px] leading-snug text-stone/80">
            Deterministic catalog match from plot size — not an AI guess.
          </p>
        </div>

        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={onView}
            className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-medium transition hover:bg-white/15 active:scale-[0.99]"
          >
            View 3D
          </button>
          <button
            type="button"
            onClick={onSelect}
            className="flex-[1.35] rounded-xl bg-brass py-3 text-sm font-semibold text-ink transition hover:bg-brass/90 active:scale-[0.99]"
          >
            Select design
          </button>
        </div>
      </div>
    </article>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] text-stone ring-1 ring-white/10">
      {children}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-stone/70">{label}</dt>
      <dd className="mt-0.5 text-sm text-paper">{value}</dd>
    </div>
  );
}
