"use client";

import { Canvas } from "@react-three/fiber";
import { XR, XRDomOverlay } from "@react-three/xr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";

import { HitTestReticle } from "@/components/ar/HitTestReticle";
import { PlotGizmo } from "@/components/ar/PlotGizmo";
import {
  ArchViewer,
  HouseRenderer,
} from "@/components/architecture/ArchViewer";
import {
  DesignCatalog,
  StylePicker,
} from "@/components/architecture/StylePicker";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api";
import { areaSqmFromPoints } from "@/lib/geometry/area";
import {
  clearProjectDraft,
  resolveValidDraft,
  saveProjectDraft,
} from "@/lib/projectDraft";
import { makeSummaryCard } from "@/lib/screenshot";
import type {
  ArchStyleCard,
  DesignMatchResponse,
  Feasibility,
  HouseDesign,
  LandUnits,
  RecommendResponse,
  WorldPoint,
} from "@/lib/types";
import { ACCURACY_DISCLAIMER, UNIT_CAVEAT } from "@/lib/types";
import { formatPkr, sqmToUnits } from "@/lib/units/land";
import { xrStore, enterAndroidAR } from "@/lib/xr/store";
import {
  detectImmersiveAR,
  supportMessage,
  type XRSupportStatus,
} from "@/lib/xr/support";

type Phase =
  | "setup"
  | "measure"
  | "style"
  | "catalog"
  | "detail"
  | "place"
  | "inspect";

type Preliminary = { estimate?: Record<string, string>; disclaimer?: string };

export default function ARExperience() {
  const router = useRouter();
  const { user, ready: authReady } = useAuth();
  const hitRef = useRef<Vector3 | null>(null);
  const autoSaveTried = useRef(false);
  const [support, setSupport] = useState<XRSupportStatus>({ kind: "checking" });
  const [sessionActive, setSessionActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [points, setPoints] = useState<WorldPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendResponse | null>(null);
  const [placed, setPlaced] = useState<WorldPoint | null>(null);
  const [lengthM, setLengthM] = useState("15");
  const [widthM, setWidthM] = useState("12");
  const [manualSqm, setManualSqm] = useState<number | null>(null);
  const [styles, setStyles] = useState<ArchStyleCard[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [match, setMatch] = useState<DesignMatchResponse | null>(null);
  const [feasibility, setFeasibility] = useState<Feasibility | null>(null);
  const [roomProgram, setRoomProgram] = useState<Record<string, number | boolean> | null>(null);
  const [preliminary, setPreliminary] = useState<Preliminary | null>(null);
  const [landUnits, setLandUnits] = useState<LandUnits | null>(null);

  useEffect(() => {
    void detectImmersiveAR().then(setSupport);
    return xrStore.subscribe((state) => {
      const active = state.session != null;
      setSessionActive((wasActive) => {
        // Only reset phase on real session end — ignore desktop session=null ticks.
        if (active && !wasActive) setPhase((p) => (p === "setup" ? "measure" : p));
        else if (!active && wasActive) setPhase("setup");
        return active;
      });
    });
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      const draft = await resolveValidDraft();
      if (cancelled || !draft) return;
      setRecommendation(draft.recommendation);
      setPoints(draft.points || []);
      setLengthM(draft.lengthM || "15");
      setWidthM(draft.widthM || "12");
      setManualSqm(draft.manualSqm);
      setLandUnits(draft.recommendation.land_units);
      setSelectedStyle(draft.preferredStyle || draft.recommendation.house.style);
      setRoomProgram(draft.recommendation.house.room_program || null);
      setPhase("detail");
      // Refresh feasibility for the restored (possibly remapped) house
      try {
        const body: Record<string, number> = {
          house_id: draft.recommendation.house.id,
          land_size_sqm: draft.recommendation.land_units.sqm,
        };
        if (draft.manualSqm != null) {
          body.plot_length_m = Number(draft.lengthM);
          body.plot_width_m = Number(draft.widthM);
        }
        const feas = await api<{
          feasibility: Feasibility;
          room_program: Record<string, number | boolean>;
        }>("/api/feasibility/", { method: "POST", body: JSON.stringify(body) });
        if (!cancelled) {
          setFeasibility(feas.feasibility);
          setRoomProgram(feas.room_program);
        }
      } catch {
        /* ignore — detail still usable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady]);

  useEffect(() => {
    if (!authReady || !user || autoSaveTried.current) return;
    let cancelled = false;
    void (async () => {
      const draft = await resolveValidDraft();
      if (cancelled || !draft?.recommendation) return;
      autoSaveTried.current = true;
      const ok = await persistProject({
        recommendation: draft.recommendation,
        points: draft.points || [],
        lengthM: draft.lengthM || "15",
        widthM: draft.widthM || "12",
        manualSqm: draft.manualSqm,
        preferredStyle: draft.preferredStyle || draft.recommendation.house.style,
      });
      if (ok) clearProjectDraft();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after login
  }, [authReady, user]);

  const liveArea = useMemo(() => {
    if (manualSqm != null && (phase === "setup" || points.length === 0)) return manualSqm;
    const fromPoints = areaSqmFromPoints(points);
    return fromPoints > 0 ? fromPoints : manualSqm ?? 0;
  }, [points, manualSqm, phase]);

  const units = landUnits ?? sqmToUnits(liveArea);

  async function enterAR() {
    setError(null);
    try {
      await enterAndroidAR();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const unsupported =
        /session configuration is not supported|not supported|WebXR not supported/i.test(
          raw,
        );
      setError(
        unsupported
          ? "AR could not start on this phone. Use manual length × width below (works for the full FYP demo), or update Chrome + “Google Play Services for AR”, then retry Enter AR."
          : raw || "Could not start AR",
      );
    }
  }

  function markCorner() {
    const hit = hitRef.current;
    if (!hit) {
      setError("Point the camera at the ground until the gold ring appears.");
      return;
    }
    if (points.length >= 8) return;
    setError(null);
    setPoints((prev) => [...prev, { x: hit.x, y: hit.y, z: hit.z }]);
  }

  async function beginStyleFlow(area: number) {
    if (!Number.isFinite(area) || area < 10) {
      setError("Need a realistic plot area (≥ 10 m²) before choosing a style.");
      return;
    }
    setBusy(true);
    setError(null);
    setRecommendation(null);
    setFeasibility(null);
    setRoomProgram(null);
    setMatch(null);
    setPlaced(null);
    try {
      const [stylesRes, estimateRes] = await Promise.all([
        api<{ styles: ArchStyleCard[] }>("/api/styles/"),
        api<{ land_units: LandUnits; preliminary_space: Preliminary }>(
          "/api/space-estimate/",
          { method: "POST", body: JSON.stringify({ land_size_sqm: area }) },
        ),
      ]);
      setStyles(stylesRes.styles);
      setLandUnits(estimateRes.land_units);
      setPreliminary(estimateRes.preliminary_space);
      setPhase("style");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load styles");
    } finally {
      setBusy(false);
    }
  }

  function applyManualPlot() {
    const area = Math.max(0, Number(lengthM) * Number(widthM));
    if (!Number.isFinite(area) || area < 10) {
      setError("Enter a realistic length and width in metres.");
      return;
    }
    setManualSqm(area);
    setPoints([]);
    void beginStyleFlow(area);
  }

  async function selectStyle(styleId: string) {
    const area = liveArea || landUnits?.sqm || 0;
    setBusy(true);
    setError(null);
    try {
      const result = await api<DesignMatchResponse>(
        `/api/designs/match/?style=${encodeURIComponent(styleId)}&plot_area=${area}`,
      );
      setSelectedStyle(styleId);
      setMatch(result);
      setLandUnits(result.land_units);
      setPhase("catalog");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Design match failed");
    } finally {
      setBusy(false);
    }
  }

  async function selectDesign(houseId: number, goPlace: boolean) {
    const area = liveArea || landUnits?.sqm || 0;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, number> = { house_id: houseId, land_size_sqm: area };
      if (manualSqm != null && points.length === 0) {
        const L = Number(lengthM);
        const W = Number(widthM);
        if (Number.isFinite(L) && Number.isFinite(W)) {
          body.plot_length_m = L;
          body.plot_width_m = W;
        }
      }
      const result = await api<{
        house: HouseDesign;
        room_program: Record<string, number | boolean>;
        feasibility: Feasibility;
        land_units: LandUnits;
      }>("/api/feasibility/", { method: "POST", body: JSON.stringify(body) });
      const reason =
        match?.message ||
        (match?.match_kind === "exact"
          ? `Exact match for ${selectedStyle || result.house.style} on ${result.land_units.display_label}.`
          : `Selected ${result.house.name} (${selectedStyle || result.house.style}) for ${result.land_units.display_label}.`);
      setRecommendation({ house: result.house, reason, land_units: result.land_units });
      setFeasibility(result.feasibility);
      setRoomProgram(result.room_program);
      setLandUnits(result.land_units);
      setPhase(goPlace && sessionActive ? "place" : "detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feasibility check failed");
    } finally {
      setBusy(false);
    }
  }

  function placeHouse() {
    const hit = hitRef.current;
    if (!hit) {
      setError("Point at the ground, then place the house.");
      return;
    }
    setPlaced({ x: hit.x, y: hit.y, z: hit.z });
    setPhase("inspect");
  }

  async function persistProject(input: {
    recommendation: RecommendResponse;
    points: WorldPoint[];
    lengthM: string;
    widthM: string;
    manualSqm: number | null;
    preferredStyle?: string | null;
  }) {
    setBusy(true);
    setError(null);
    try {
      const blob = await makeSummaryCard({
        house: input.recommendation.house,
        units: input.recommendation.land_units,
      });
      const form = new FormData();
      form.append("land_size_sqm", String(input.recommendation.land_units.sqm));
      form.append("land_size_display_unit", input.recommendation.land_units.display_unit);
      form.append("selected_house_id", String(input.recommendation.house.id));
      form.append("recommendation_reason", input.recommendation.reason);
      const style =
        input.preferredStyle || selectedStyle || input.recommendation.house.style;
      if (style) form.append("preferred_style", style);
      form.append("plot_points", JSON.stringify(input.points));
      const isManual = input.points.length === 0 && input.manualSqm != null;
      form.append("measurement_type", isManual ? "manual" : "ar");
      if (isManual) {
        form.append("plot_length_m", String(Number(input.lengthM)));
        form.append("plot_width_m", String(Number(input.widthM)));
        form.append("name", `Manual ${Number(input.lengthM)}×${Number(input.widthM)} m`);
      } else {
        form.append("name", `AR plot ${input.recommendation.land_units.display_label}`);
      }
      form.append("screenshot", blob, "plot.png");
      const project = await api<{ id: number }>("/api/projects/", { method: "POST", body: form });
      try {
        await api(`/api/projects/${project.id}/report/`, { method: "POST" });
      } catch {
        /* report optional */
      }
      router.push(`/projects/${project.id}`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save project");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveProject() {
    if (!recommendation) return;
    if (!user) {
      saveProjectDraft({
        recommendation,
        points,
        lengthM,
        widthM,
        manualSqm,
        preferredStyle: selectedStyle,
      });
      router.push("/login?next=/ar");
      return;
    }
    const ok = await persistProject({
      recommendation,
      points,
      lengthM,
      widthM,
      manualSqm,
      preferredStyle: selectedStyle,
    });
    if (ok) clearProjectDraft();
  }

  function resetAll() {
    setPoints([]);
    setRecommendation(null);
    setPlaced(null);
    setManualSqm(null);
    setStyles([]);
    setSelectedStyle(null);
    setMatch(null);
    setFeasibility(null);
    setRoomProgram(null);
    setPreliminary(null);
    setLandUnits(null);
    setPhase(sessionActive ? "measure" : "setup");
  }

  const catalogDesigns = match
    ? match.exact.length > 0
      ? match.exact
      : match.nearby
    : [];
  const showPreview =
    !sessionActive && recommendation && (phase === "detail" || phase === "inspect");

  const hud = (
    <Hud
      support={support}
      sessionActive={sessionActive}
      phase={phase}
      error={error}
      busy={busy}
      points={points}
      units={units}
      recommendation={recommendation}
      feasibility={feasibility}
      roomProgram={roomProgram}
      styles={styles}
      preliminary={preliminary}
      selectedStyle={selectedStyle}
      match={match}
      catalogDesigns={catalogDesigns}
      lengthM={lengthM}
      widthM={widthM}
      loggedIn={Boolean(user)}
      onEnterAR={() => void enterAR()}
      onMarkCorner={markCorner}
      onUndo={() => setPoints((p) => p.slice(0, -1))}
      onReset={resetAll}
      onFinishMeasure={() => void beginStyleFlow(liveArea)}
      onPlace={placeHouse}
      onSave={() => void saveProject()}
      onLength={setLengthM}
      onWidth={setWidthM}
      onManual={() => applyManualPlot()}
      onResetPlacement={() => {
        setPlaced(null);
        setPhase(sessionActive ? "place" : "detail");
      }}
      onSelectStyle={(id) => void selectStyle(id)}
      onChangeStyle={() => setPhase("style")}
      onSelectDesign={(id) => void selectDesign(id, true)}
      onViewDesign={(id) => void selectDesign(id, false)}
      onBackToMeasure={() => setPhase(sessionActive ? "measure" : "setup")}
    />
  );

  return (
    <div id="plotline-ar-overlay" className="ar-lock relative bg-ink text-paper">
      {/* Full-bleed 3D when a design is selected (desktop) */}
      {showPreview && (
        <div className="absolute inset-0 z-0">
          <ArchViewer
            design={recommendation.house}
            className="h-full w-full"
          />
        </div>
      )}

      {!sessionActive && (
        <div
          className={
            showPreview
              ? "pointer-events-none absolute inset-x-0 bottom-0 z-10 max-h-[48vh] overflow-y-auto p-3"
              : "pointer-events-none absolute inset-x-0 top-0 z-10 max-h-dvh overflow-y-auto p-3"
          }
        >
          <div className="pointer-events-auto">{hud}</div>
        </div>
      )}

      <Canvas
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{
          background: sessionActive ? "transparent" : showPreview ? "transparent" : "#1c1916",
          visibility: showPreview && !sessionActive ? "hidden" : "visible",
        }}
        camera={{ position: [0, 1.6, 4], fov: 50 }}
      >
        <XR store={xrStore}>
          <ambientLight intensity={1.1} />
          <directionalLight position={[4, 8, 3]} intensity={1.4} />
          <HitTestReticle hitRef={hitRef} visible={sessionActive && !placed} />
          <PlotGizmo points={points} />
          {recommendation && placed && (
            <group position={[placed.x, placed.y, placed.z]}>
              <HouseRenderer design={recommendation.house} />
            </group>
          )}
          {sessionActive && (
            <XRDomOverlay
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                pointerEvents: "none",
              }}
            >
              <div className="pointer-events-auto max-h-[70%] overflow-y-auto p-3">
                {hud}
              </div>
            </XRDomOverlay>
          )}
        </XR>
      </Canvas>
    </div>
  );
}

function Hud(p: {
  support: XRSupportStatus;
  sessionActive: boolean;
  phase: Phase;
  error: string | null;
  busy: boolean;
  points: WorldPoint[];
  units: LandUnits;
  recommendation: RecommendResponse | null;
  feasibility: Feasibility | null;
  roomProgram: Record<string, number | boolean> | null;
  styles: ArchStyleCard[];
  preliminary: Preliminary | null;
  selectedStyle: string | null;
  match: DesignMatchResponse | null;
  catalogDesigns: HouseDesign[];
  lengthM: string;
  widthM: string;
  loggedIn: boolean;
  onEnterAR: () => void;
  onMarkCorner: () => void;
  onUndo: () => void;
  onReset: () => void;
  onFinishMeasure: () => void;
  onPlace: () => void;
  onSave: () => void;
  onLength: (v: string) => void;
  onWidth: (v: string) => void;
  onManual: () => void;
  onResetPlacement: () => void;
  onSelectStyle: (id: string) => void;
  onChangeStyle: () => void;
  onSelectDesign: (id: number) => void;
  onViewDesign: (id: number) => void;
  onBackToMeasure: () => void;
}) {
  const err = p.error ? (
    <p className="mb-2 text-sm text-red-300" role="alert">
      {p.error}
    </p>
  ) : null;

  if (p.phase === "style") {
    return (
      <div>
        {err}
        <StylePicker
          units={p.units}
          styles={p.styles}
          preliminary={p.preliminary}
          onSelect={p.onSelectStyle}
          onBack={p.onBackToMeasure}
        />
      </div>
    );
  }

  if (p.phase === "catalog" && p.match) {
    return (
      <div>
        {err}
        <DesignCatalog
          style={p.selectedStyle || p.match.style || ""}
          units={p.units}
          matchKind={p.match.match_kind}
          message={p.match.message}
          designs={p.catalogDesigns}
          onSelect={p.onSelectDesign}
          onChangeStyle={p.onChangeStyle}
          onView={p.onViewDesign}
        />
      </div>
    );
  }

  if ((p.phase === "detail" || p.phase === "inspect") && p.recommendation) {
    const house = p.recommendation.house;
    const rooms = p.roomProgram || house.room_program || {};
    const chips = [
      ["Bedrooms", rooms.bedrooms ?? house.bedrooms],
      ["Baths", rooms.bathrooms ?? house.bathrooms],
      ["Living", rooms.living_rooms],
      ["Dining", rooms.dining_rooms],
      ["Kitchen", rooms.kitchens],
      ["Parking", rooms.parking_spaces],
      ["Floors", rooms.floors ?? house.floors],
    ].filter(([, v]) => v !== undefined && v !== null && v !== false);

    return (
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl bg-ink/92 text-paper shadow-2xl ring-1 ring-white/12 backdrop-blur-md">
        {err}
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            <p className="truncate font-serif text-xl tracking-tight">{house.name}</p>
            <p className="mt-0.5 text-xs text-stone">
              {house.style} · {p.units.display_label}
            </p>
            <p className="mt-1 text-sm text-brass">{formatPkr(house.estimated_cost_pkr)}</p>
          </div>
          <Link href="/" className="shrink-0 text-xs text-brass">
            Home
          </Link>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {chips.map(([label, value]) => (
            <span
              key={String(label)}
              className="shrink-0 rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-paper/90 ring-1 ring-white/10"
            >
              <span className="text-stone">{label} </span>
              {String(value)}
            </span>
          ))}
        </div>

        {p.feasibility && (
          <div className="mx-4 mt-3 rounded-xl bg-white/5 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wide text-stone">Plot fit</p>
              <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] text-brass">
                {p.feasibility.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-sm font-medium text-paper">
                  {p.feasibility.building_footprint_sqm.toFixed(0)}
                </p>
                <p className="text-[10px] text-stone">m² build</p>
              </div>
              <div>
                <p className="text-sm font-medium text-paper">
                  {p.feasibility.remaining_area_sqm.toFixed(0)}
                </p>
                <p className="text-[10px] text-stone">m² open</p>
              </div>
              <div>
                <p className="text-sm font-medium text-paper">
                  {p.feasibility.ground_coverage_percent.toFixed(0)}%
                </p>
                <p className="text-[10px] text-stone">coverage</p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-2 px-4 text-[11px] leading-snug text-stone/85">
          {p.recommendation.reason}
        </p>

        {p.sessionActive && p.phase === "inspect" && (
          <button
            type="button"
            onClick={p.onResetPlacement}
            className="mx-4 mt-2 w-[calc(100%-2rem)] rounded-xl bg-white/10 py-2 text-sm"
          >
            Reset placement
          </button>
        )}

        <div className="mt-3 flex gap-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={p.onReset}
            className="flex-1 rounded-xl bg-white/10 py-3 text-sm"
          >
            Start over
          </button>
          <button
            type="button"
            onClick={p.onSave}
            disabled={p.busy}
            className="flex-[2] rounded-xl bg-brass py-3 text-sm font-medium text-ink disabled:opacity-60"
          >
            {p.busy ? "Saving…" : p.loggedIn ? "Save + AI report" : "Log in to save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-ink/90 p-4 text-paper shadow-xl ring-1 ring-white/10">
      <div className="flex justify-between gap-3">
        <div>
          <p className="font-serif text-lg">Plotline</p>
          <p className="text-xs text-stone">{supportMessage(p.support)}</p>
        </div>
        <Link href="/" className="text-xs text-brass">
          Home
        </Link>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-stone/90">
        {ACCURACY_DISCLAIMER} {UNIT_CAVEAT}
      </p>
      {err}
      {(p.points.length > 0 || p.units.sqm > 0) && (
        <p className="mt-3 text-sm">
          {p.points.length > 0 ? `POINTS ${p.points.length}` : "Manual"} ·{" "}
          <span className="text-brass">{p.units.display_label}</span>
          <span className="mt-1 block text-xs text-stone">
            {p.units.sqm.toFixed(1)} m² · {p.units.marla.toFixed(2)} Marla
          </span>
        </p>
      )}

      {!p.sessionActive && p.phase === "setup" && (
        <div className="mt-4 space-y-3">
          {p.support.kind === "supported" ? (
            <ol className="list-decimal space-y-1 pl-4 text-[11px] text-stone">
              <li>Move your phone slowly to detect a surface</li>
              <li>Wait for the gold ring on the ground</li>
              <li>Tap corners of the plot in order (3–8 points)</li>
              <li>Finish → choose style → place the house → walk around</li>
            </ol>
          ) : (
            <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-100">
              AR is not available on this device/browser. Continue with manual length × width
              and the 3D Orbit viewer. Physical AR requires Android Chrome + ARCore + HTTPS.
            </p>
          )}
          <button
            type="button"
            onClick={p.onEnterAR}
            disabled={p.support.kind !== "supported"}
            className="w-full rounded-xl bg-brass py-3 font-medium text-ink disabled:bg-white/10 disabled:text-stone"
          >
            {p.support.kind === "supported" ? "Enter AR" : "AR unavailable — use manual below"}
          </button>
          <p className="text-center text-[10px] uppercase tracking-wide text-stone">
            Or measure manually (approximate)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-stone">
              Length (m)
              <input
                value={p.lengthM}
                onChange={(e) => p.onLength(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-paper"
              />
            </label>
            <label className="text-xs text-stone">
              Width (m)
              <input
                value={p.widthM}
                onChange={(e) => p.onWidth(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-paper"
              />
            </label>
          </div>
          {(Number(p.lengthM) > 0 && Number(p.widthM) > 0) && (
            <p className="rounded-xl bg-brass/15 px-3 py-2 text-center text-sm text-brass">
              Area ≈ {(Number(p.lengthM) * Number(p.widthM)).toFixed(1)} m²
            </p>
          )}
          <button
            type="button"
            onClick={p.onManual}
            disabled={p.busy}
            className="w-full rounded-xl border border-white/15 py-3 text-sm"
          >
            {p.busy ? "Loading styles…" : "Continue to style choice"}
          </button>
        </div>
      )}

      {p.sessionActive && p.phase === "measure" && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={p.onMarkCorner} className="rounded-xl bg-brass py-3 text-sm font-medium text-ink">
            Mark ({p.points.length}/8)
          </button>
          <button type="button" onClick={p.onUndo} className="rounded-xl bg-white/10 py-3 text-sm">
            Undo
          </button>
          <button type="button" onClick={p.onReset} className="rounded-xl bg-white/10 py-3 text-sm">
            Clear
          </button>
          <button
            type="button"
            disabled={p.points.length < 3 || p.busy}
            onClick={p.onFinishMeasure}
            className="rounded-xl bg-paper py-3 text-sm font-medium text-ink disabled:bg-white/10 disabled:text-stone"
          >
            {p.busy ? "Loading…" : "Finish & recommend"}
          </button>
        </div>
      )}

      {p.phase === "place" && p.sessionActive && (
        <button
          type="button"
          onClick={p.onPlace}
          className="mt-4 w-full rounded-xl bg-brass py-3 font-medium text-ink"
        >
          Place house on plot
        </button>
      )}
    </div>
  );
}
