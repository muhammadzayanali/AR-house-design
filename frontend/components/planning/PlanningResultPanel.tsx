"use client";

import type { PlanningSummary } from "@/lib/types";
import { formatPkr } from "@/lib/units/land";

function fmtParking(min?: number | boolean | null, max?: number | boolean | null) {
  const a = typeof min === "number" ? min : null;
  const b = typeof max === "number" ? max : null;
  if (a == null && b == null) return "—";
  if (a != null && b != null && a !== b) return `${a}–${b}`;
  return String(b ?? a);
}

export function PlanningResultPanel({
  plan,
  variant = "light",
}: {
  plan: PlanningSummary;
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  const card = dark
    ? "rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10"
    : "rounded-xl bg-white p-3.5 ring-1 ring-ink/10";
  const title = dark ? "text-paper" : "text-ink";
  const muted = dark ? "text-stone" : "text-muted";
  const accent = "text-brass";

  const plot = plan.plot;
  const planning = plan.planning;
  const rooms = plan.room_program || {};
  const sizes = plan.room_sizes || {};
  const cost = plan.cost_estimate;
  const feas = plan.feasibility;

  const programRows: [string, string][] = [
    ["Bedrooms", String(rooms.bedrooms ?? "—")],
    ["Bathrooms", String(rooms.bathrooms ?? "—")],
    ["Powder", String(rooms.powder_rooms ?? 0)],
    ["Kitchen", String(rooms.kitchens ?? "—")],
    ["Dining", String(rooms.dining_rooms ?? "—")],
    ["Drawing", String(rooms.drawing_rooms ?? 0)],
    [
      "Family / Living",
      String(rooms.family_lounges ?? rooms.family_rooms ?? rooms.living_rooms ?? "—"),
    ],
    [
      "Parking",
      `${fmtParking(rooms.parking_spaces_min, rooms.parking_spaces_max)} (geometry)`,
    ],
    ["Floors", String(rooms.floors ?? planning?.recommended_floors ?? "—")],
  ];

  const sizeEntries = Object.entries(sizes).slice(0, 8);

  return (
    <div className="space-y-3">
      <section className={card}>
        <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>
          Plot overview
        </p>
        <p className={`mt-1 font-serif text-xl ${title}`}>
          {plot?.area_m2 ?? "—"} m²
          {plot?.marla != null ? ` · ${Number(plot.marla).toFixed(2)} Marla` : ""}
        </p>
        <p className={`mt-0.5 text-sm ${muted}`}>
          {plot?.area_sqft != null ? `≈ ${Number(plot.area_sqft).toLocaleString()} sq ft` : ""}
          {plot?.display_label ? ` · ${plot.display_label}` : ""}
        </p>
      </section>

      <section className={card}>
        <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>
          Recommended home
        </p>
        <p className={`mt-1 font-serif text-lg ${title}`}>
          {planning?.title || "Preliminary programme"}
        </p>
        <p className={`mt-0.5 text-xs ${muted}`}>
          Band {planning?.band_label || planning?.band || "—"} ·{" "}
          {planning?.source === "house_design" ? "Design catalogue" : "Planning band"}
        </p>
      </section>

      <section className={card}>
        <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>
          Room programme
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2">
          {programRows.map(([label, value]) => (
            <div key={label} className={`rounded-lg px-2.5 py-2 ${dark ? "bg-white/5" : "bg-black/[0.04]"}`}>
              <dt className={`text-[10px] uppercase tracking-wide ${muted}`}>{label}</dt>
              <dd className={`mt-0.5 text-sm font-medium ${title}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {sizeEntries.length > 0 && (
        <section className={card}>
          <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>
            Approximate room sizes
          </p>
          <ul className="mt-2 space-y-1.5">
            {sizeEntries.map(([name, dims]) => (
              <li
                key={name}
                className={`flex items-center justify-between gap-2 text-sm ${title}`}
              >
                <span className="capitalize">{name.replace(/_/g, " ")}</span>
                <span className={muted}>
                  {dims.length_ft} × {dims.width_ft} ft
                  {dims.area_sqft != null ? ` · ${dims.area_sqft} sqft` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>
          Building feasibility
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact
            label="Footprint"
            value={`${Number(feas?.building_footprint_sqm ?? planning?.covered_area_m2 ?? 0).toFixed(0)} m²`}
            muted={muted}
            title={title}
          />
          <Fact
            label="Coverage"
            value={`${Number(feas?.ground_coverage_percent ?? planning?.coverage_percent ?? 0).toFixed(0)}%`}
            muted={muted}
            title={title}
          />
          <Fact
            label="Floors"
            value={String(rooms.floors ?? planning?.recommended_floors ?? "—")}
            muted={muted}
            title={title}
          />
          <Fact
            label="Remaining"
            value={`${Number(feas?.remaining_area_sqm ?? planning?.remaining_area_m2 ?? 0).toFixed(0)} m²`}
            muted={muted}
            title={title}
          />
        </div>
        {feas?.status && (
          <p className={`mt-2 text-xs ${accent}`}>{feas.status.replace(/_/g, " ")}</p>
        )}
      </section>

      {cost && (
        <section className={card}>
          <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>
            Construction estimate
          </p>
          <p className={`mt-1 font-serif text-xl ${accent}`}>
            {formatPkr(cost.min)} – {formatPkr(cost.max)}
          </p>
          <p className={`mt-1 text-xs ${muted}`}>
            {cost.source} · {cost.quality} · preliminary
          </p>
          <p className={`mt-2 text-xs ${muted}`}>
            Built ~{cost.built_area_sqft ?? cost.covered_area_sqft} sq ft
            {cost.floors != null && cost.floors > 1
              ? ` (≈ footprint × ${cost.floors} floors)`
              : ""}{" "}
            · ~PKR {cost.reference_rate_pkr_per_sqft}/sq ft
          </p>
          <p className={`mt-2 text-[11px] leading-snug ${muted}`}>
            {cost.disclaimer ||
              "Costs vary with city, materials, labour, covered area and design complexity."}
          </p>
        </section>
      )}

      <p className={`text-[11px] leading-snug ${muted}`}>
        Planning estimates are preliminary and intended for conceptual planning. Final
        architectural drawings, structural engineering, site verification, applicable
        regulations, approvals and contractor quotations are required before construction.
      </p>
    </div>
  );
}

function Fact({
  label,
  value,
  muted,
  title,
}: {
  label: string;
  value: string;
  muted: string;
  title: string;
}) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wide ${muted}`}>{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${title}`}>{value}</p>
    </div>
  );
}
