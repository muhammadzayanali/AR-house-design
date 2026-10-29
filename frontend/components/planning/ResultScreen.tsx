"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Feasibility, HouseDesign, LandUnits } from "@/lib/types";
import { supportMessage, type XRSupportStatus } from "@/lib/xr/support";
import { formatPkr } from "@/lib/units/land";

type Tab = "overview" | "rooms" | "feasibility" | "report" | "ask";
type Snap = "peek" | "half" | "full";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "rooms", label: "Rooms" },
  { id: "feasibility", label: "Feasibility" },
  { id: "report", label: "Report" },
  { id: "ask", label: "Ask" },
];

function snapPx(snap: Snap, viewport: number) {
  if (snap === "peek") return 200;
  if (snap === "half") return Math.round(viewport * 0.42);
  return Math.round(viewport * 0.86);
}

export function ResultScreen({
  house,
  units,
  reason,
  feasibility,
  roomProgram,
  evening,
  onEvening,
  support,
  onViewAR,
  onSave,
  onBack,
  generated,
  onSheetHeight,
}: {
  house: HouseDesign;
  units: LandUnits;
  reason?: string;
  feasibility: Feasibility | null;
  roomProgram: Record<string, number | boolean> | null;
  evening: boolean;
  onEvening: (next: boolean) => void;
  support: XRSupportStatus;
  onViewAR: () => void;
  onSave: () => void;
  onBack: () => void;
  generated: boolean;
  onSheetHeight?: (px: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [snap, setSnap] = useState<Snap>("half");
  const [costOpen, setCostOpen] = useState(false);
  const rooms = roomProgram || house.room_program || {};
  const beds = Number(rooms.bedrooms ?? house.bedrooms ?? 0);
  const baths = Number(rooms.bathrooms ?? house.bathrooms ?? 0);
  const floors = Number(rooms.floors ?? house.floors ?? 1);
  const parking = house.parking ? "Yes" : "No";
  const arOk = support.kind === "supported";
  const arReason = support.kind === "supported" ? "" : supportMessage(support);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const report = () => {
      if (mq.matches) onSheetHeight?.(0);
      else onSheetHeight?.(snapPx(snap, window.innerHeight));
    };
    report();
    mq.addEventListener("change", report);
    window.addEventListener("resize", report);
    return () => {
      mq.removeEventListener("change", report);
      window.removeEventListener("resize", report);
    };
  }, [snap, onSheetHeight]);

  const onPointerDown = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const start = snap;
    const up = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      const order: Snap[] = ["peek", "half", "full"];
      const i = order.indexOf(start);
      if (dy < -48 && i < 2) setSnap(order[i + 1]);
      else if (dy > 48 && i > 0) setSnap(order[i - 1]);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointerup", up);
  };

  const stats = [
    ["Beds", String(beds || "—")],
    ["Baths", String(baths || "—")],
    ["Floors", String(floors || "—")],
    ["Parking", parking],
  ];

  return (
    <section
      className="result-sheet pointer-events-auto flex flex-col bg-[#161411] text-paper shadow-[0_-12px_40px_rgba(0,0,0,0.35)] lg:h-full lg:max-h-none lg:w-[35%] lg:min-w-[320px] lg:shadow-none lg:ring-1 lg:ring-white/10"
      style={{ height: undefined }}
      data-snap={snap}
    >
      <style>{`
        .result-sheet { height: ${snap === "peek" ? "200px" : snap === "half" ? "42dvh" : "86dvh"}; overflow: hidden; }
        @media (min-width: 1024px) {
          .result-sheet { height: 100% !important; position: relative !important; overflow: hidden; }
        }
        @media (max-width: 1023px) {
          .result-sheet {
            position: absolute; left: 0; right: 0; bottom: 0; z-index: 20;
            border-radius: 20px 20px 0 0;
            padding-bottom: env(safe-area-inset-bottom);
            overflow: hidden;
          }
        }
        @media (prefers-reduced-motion: no-preference) {
          .result-sheet { transition: height 180ms ease; }
        }
      `}</style>

      <div className="flex items-center gap-2 px-3 lg:hidden">
        <button
          type="button"
          aria-label="Drag sheet"
          onPointerDown={onPointerDown}
          className="flex h-11 flex-1 items-center justify-center"
        >
          <span className="h-1.5 w-10 rounded-full bg-white/30" />
        </button>
        {(["peek", "half", "full"] as Snap[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSnap(s)}
            className={`min-h-11 rounded-lg px-3 text-xs capitalize ${
              snap === s ? "bg-white text-ink" : "text-stone"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <header className="space-y-2 px-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 shrink-0 rounded-lg px-2 text-sm text-brass"
          >
            ← Designs
          </button>
          <Link href="/" className="min-h-11 rounded-lg px-2 py-3 text-sm text-stone">
            Exit
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-2xl leading-tight tracking-tight">{house.name}</h1>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{house.style}</span>
          {generated ? (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-stone">
              Generated massing model
            </span>
          ) : (
            <Link href="/credits" className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-brass">
              Credits
            </Link>
          )}
        </div>
        <p className="text-sm text-stone">
          {units.sqm.toFixed(0)} m² · {units.marla.toFixed(2)} Marla
        </p>
        <div className="flex flex-wrap gap-2">
          {stats.map(([k, v]) => (
            <span key={k} className="rounded-lg bg-white/8 px-2.5 py-1.5 text-xs ring-1 ring-white/10">
              <span className="text-stone">{k} </span>
              {v}
            </span>
          ))}
        </div>
      </header>

      <div className="flex gap-2 px-4 pb-2">
        <button
          type="button"
          disabled={!arOk}
          title={arReason}
          onClick={onViewAR}
          className="min-h-11 flex-1 rounded-xl bg-brass px-3 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-stone"
        >
          View in AR
        </button>
        <button
          type="button"
          onClick={onSave}
          className="min-h-11 flex-1 rounded-xl bg-white/10 px-3 text-sm ring-1 ring-white/15"
        >
          Save project
        </button>
      </div>
      {!arOk ? <p className="px-4 pb-2 text-xs text-stone">{arReason}</p> : null}

      <div className="flex items-center justify-between gap-2 px-4 pb-2">
        <div className="relative">
          <p className="text-sm text-brass">
            Preliminary estimate {formatPkr(house.estimated_cost_pkr)}
          </p>
          <button
            type="button"
            className="mt-1 min-h-11 text-xs text-stone underline"
            onClick={() => setCostOpen((v) => !v)}
            aria-expanded={costOpen}
          >
            What does this mean?
          </button>
          {costOpen ? (
            <p className="mt-1 max-w-xs text-xs leading-snug text-stone">
              A planning figure from the catalogue band. Not a contractor quote.
            </p>
          ) : null}
        </div>
        <div className="flex overflow-hidden rounded-full ring-1 ring-white/15" role="group" aria-label="Lighting">
          <button
            type="button"
            onClick={() => onEvening(false)}
            className={`min-h-11 px-3 text-xs ${evening ? "text-stone" : "bg-white text-ink"}`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => onEvening(true)}
            className={`min-h-11 px-3 text-xs ${evening ? "bg-amber-200 text-ink" : "text-stone"}`}
          >
            Evening
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto px-3 pb-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 shrink-0 rounded-lg px-3 text-sm ${
              tab === t.id ? "bg-white text-ink" : "text-stone"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 text-sm leading-relaxed">
        {tab === "overview" && (
          <div className="space-y-2">
            <p>{reason || house.description}</p>
            <p className="text-stone">
              Footprint about {house.building_width_m || "—"} × {house.building_depth_m || "—"} m.
            </p>
          </div>
        )}
        {tab === "rooms" && (
          <ul className="space-y-2">
            {Object.entries(rooms)
              .slice(0, 12)
              .map(([k, v]) => (
                <li key={k} className="flex justify-between gap-3 border-b border-white/10 py-2">
                  <span className="text-stone">{k.replaceAll("_", " ")}</span>
                  <span>{String(v)}</span>
                </li>
              ))}
          </ul>
        )}
        {tab === "feasibility" && (
          <ul className="space-y-2 text-stone">
            <li>Ground coverage {feasibility?.ground_coverage_percent ?? "—"}%</li>
            <li>Building footprint {feasibility?.building_footprint_sqm ?? "—"} m²</li>
            <li>Remaining plot {feasibility?.remaining_area_sqm ?? "—"} m²</li>
          </ul>
        )}
        {tab === "report" && (
          <p className="text-stone">
            Save the project to generate the written planning report. This screen is a massing study, not a construction drawing.
          </p>
        )}
        {tab === "ask" && (
          <p className="text-stone">
            Save the project, then open it to ask the planning assistant. Answers stay inside the saved brief.
          </p>
        )}
      </div>
    </section>
  );
}
