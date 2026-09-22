"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ArchViewer } from "@/components/architecture/ArchViewer";
import { ModelViewer } from "@/components/viewer/ModelViewer";
import { api } from "@/lib/api";
import type { Project, Report } from "@/lib/types";
import { ACCURACY_DISCLAIMER, UNIT_CAVEAT } from "@/lib/types";
import { formatPkr } from "@/lib/units/land";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("Why was this house recommended?");
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerSource, setAnswerSource] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Project>(`/api/projects/${params.id}/`)
      .then(setProject)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Project not found"),
      );
  }, [params.id]);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const report = await api<Report & { warning?: string; ai_available?: boolean }>(
        `/api/projects/${params.id}/report/`,
        { method: "POST" },
      );
      setProject((prev) =>
        prev
          ? {
              ...prev,
              latest_report: {
                id: report.id,
                project: prev.id,
                narration_text: report.narration_text,
                generated_at: report.generated_at,
                source: report.source,
                model_name: report.model_name,
              },
            }
          : prev,
      );
      setWarning(report.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{
        answer: string;
        source: string;
        warning?: string | null;
        ai_available?: boolean;
      }>(`/api/projects/${params.id}/ask/`, {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setAnswer(result.answer);
      setAnswerSource(result.source);
      setWarning(result.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Q&A failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this project?")) return;
    setBusy(true);
    try {
      await api(`/api/projects/${params.id}/`, { method: "DELETE" });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  if (error && !project) {
    return <main className="p-8 text-red-700">{error}</main>;
  }
  if (!project) {
    return <main className="p-8 text-muted">Loading project…</main>;
  }

  const house = project.selected_house;
  const reportSource = project.latest_report?.source;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="text-sm text-brass">
          ← Projects
        </Link>
        <div className="flex gap-3 text-sm">
          <Link href="/ar" className="text-brass">
            New AR / measure
          </Link>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="text-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      <h1 className="mt-4 font-serif text-4xl">
        {project.name || project.land_units.display_label}
      </h1>
      <p className="mt-2 text-muted">
        {house?.name} · {house?.style} · {house?.floors} floor(s) · {house?.bedrooms}{" "}
        bedrooms · parking {house?.parking ? "yes" : "no"} ·{" "}
        {house ? formatPkr(house.estimated_cost_pkr) : ""}
      </p>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {warning && <p className="mt-3 text-sm text-amber-800">{warning}</p>}

      <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-ink/10">
        <h2 className="font-serif text-2xl">Plot</h2>
        <p className="mt-2 text-sm text-muted">{ACCURACY_DISCLAIMER}</p>
        <p className="mt-1 text-sm text-muted">{UNIT_CAVEAT}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted">Area</dt>
            <dd>{project.land_units.sqm} m²</dd>
          </div>
          <div>
            <dt className="text-muted">Marla / Kanal / Acre</dt>
            <dd>
              {project.land_units.marla} / {project.land_units.kanal} /{" "}
              {project.land_units.acre}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Measurement</dt>
            <dd>{project.measurement_type === "ar" ? "AR hit-test" : "Manual rectangle"}</dd>
          </div>
          {(project.plot_length_m || project.plot_width_m) && (
            <div>
              <dt className="text-muted">Dimensions</dt>
              <dd>
                {project.plot_length_m ?? "—"} m × {project.plot_width_m ?? "—"} m
              </dd>
            </div>
          )}
        </dl>
      </section>

      {house && (
        <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-ink/10">
          <h2 className="font-serif text-2xl">Selected design</h2>
          <p className="mt-1 text-sm text-muted">
            {house.style}
            {project.preferred_style ? ` · preferred ${project.preferred_style}` : ""}
          </p>
          <p className="mt-2 text-sm text-muted">{project.recommendation_reason}</p>
          <div className="mt-6">
            {house.model_type === "procedural" || !house.glb_url ? (
              <ArchViewer design={house} />
            ) : (
              <ModelViewer glbUrl={house.glb_url || house.model_url} design={house} />
            )}
          </div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-muted">Bedrooms / Baths</dt>
              <dd>
                {house.bedrooms} / {house.bathrooms}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Living / Dining / Kitchen</dt>
              <dd>
                {house.living_rooms ?? 1} / {house.dining_rooms ?? 1} /{" "}
                {house.kitchens ?? 1}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Parking / Floors</dt>
              <dd>
                {house.parking_spaces ?? (house.parking ? 1 : 0)} / {house.floors}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {project.feasibility && (
        <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-ink/10">
          <h2 className="font-serif text-2xl">Plot utilization</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-muted">Building footprint</dt>
              <dd>{project.feasibility.building_footprint_sqm} m²</dd>
            </div>
            <div>
              <dt className="text-muted">Remaining area</dt>
              <dd>{project.feasibility.remaining_area_sqm} m²</dd>
            </div>
            <div>
              <dt className="text-muted">Ground coverage</dt>
              <dd>{project.feasibility.ground_coverage_percent}%</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd>{project.feasibility.status}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted">{project.feasibility.note}</p>
          <p className="mt-1 text-xs text-muted">{project.feasibility.disclaimer}</p>
        </section>
      )}

      <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-ink/10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">AI report</h2>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={busy}
            className="text-sm text-brass"
          >
            Regenerate
          </button>
        </div>
        {reportSource && (
          <p className="mt-2 text-xs text-muted">
            Source:{" "}
            {reportSource === "huggingface"
              ? "Hugging Face LLM"
              : reportSource === "local_rag"
                ? "Local RAG (project fields + knowledge base)"
                : reportSource === "template"
                  ? "Structured summary"
                  : "Unavailable"}
            {project.latest_report?.model_name
              ? ` · ${project.latest_report.model_name}`
              : ""}
          </p>
        )}
        <p className="mt-4 whitespace-pre-wrap leading-7 text-ink/90">
          {project.latest_report?.narration_text ??
            "No report yet. Tap regenerate — local RAG works without HF_TOKEN."}
        </p>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-ink/10">
        <h2 className="font-serif text-2xl">Ask the consultant</h2>
        <p className="mt-1 text-sm text-muted">
          Local RAG answers from this project&apos;s saved fields plus a built-in
          architecture knowledge base. Optional Hugging Face polish when configured.
          Never sees the camera feed. Not a licensed architect.
        </p>
        <textarea
          className="mt-4 w-full rounded-xl border border-ink/15 p-3"
          rows={3}
          maxLength={800}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy}
          className="mt-3 rounded-full bg-ink px-5 py-2 text-paper"
        >
          {busy ? "Thinking…" : "Ask"}
        </button>
        {answer && (
          <div className="mt-4">
            {answerSource && (
              <p className="text-xs text-muted">
                Source:{" "}
                {answerSource === "huggingface"
                  ? "Hugging Face LLM (+ local RAG context)"
                  : answerSource === "local_rag"
                    ? "Local RAG (project fields + knowledge base)"
                    : "Fallback"}
              </p>
            )}
            <p className="mt-2 whitespace-pre-wrap leading-7">{answer}</p>
            <div className="mt-4 grid gap-2 text-[11px] text-muted sm:grid-cols-3">
              <p className="rounded-lg bg-ink/5 p-2">
                <span className="font-medium text-ink">Facts</span> — plot, design,
                rooms, footprint, coverage from Django engines.
              </p>
              <p className="rounded-lg bg-ink/5 p-2">
                <span className="font-medium text-ink">Estimates</span> — catalog cost
                bands only (not quotations).
              </p>
              <p className="rounded-lg bg-ink/5 p-2">
                <span className="font-medium text-ink">Limitations</span> — not a survey,
                bylaw check, or licensed architect.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
