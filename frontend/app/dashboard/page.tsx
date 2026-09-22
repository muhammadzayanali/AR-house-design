"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { api, resolveMediaUrl } from "@/lib/api";
import type { HealthResponse, Project } from "@/lib/types";
import { formatPkr } from "@/lib/units/land";

export default function DashboardPage() {
  const { user, ready } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!ready || !user) return;
    api<Project[]>("/api/projects/")
      .then(setProjects)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load projects"),
      );
  }, [ready, user]);

  useEffect(() => {
    load();
    api<HealthResponse>("/api/health/")
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [load]);

  async function removeProject(id: number) {
    if (!window.confirm("Delete this project permanently?")) return;
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/projects/${id}/`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) {
    return <main className="p-8 text-muted">Loading…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-serif text-3xl">Saved projects</h1>
        <p className="mt-3 text-muted">Log in to see plots you have measured.</p>
        <Link
          href="/login?next=/dashboard"
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-paper"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Projects</h1>
          <p className="mt-1 text-muted">
            Plot size, style, and AI report for each save.
          </p>
        </div>
        <Link href="/ar" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
          New measurement
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
          <p className="text-xs uppercase tracking-wide text-muted">Total projects</p>
          <p className="mt-1 font-serif text-3xl">{projects.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
          <p className="text-xs uppercase tracking-wide text-muted">With reports</p>
          <p className="mt-1 font-serif text-3xl">
            {projects.filter((p) => p.latest_report).length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
          <p className="text-xs uppercase tracking-wide text-muted">AI consultant</p>
          <p className="mt-1 text-sm font-medium">
            {health?.llm_configured ? "Live (Hugging Face)" : "Unavailable / template"}
          </p>
          <p className="mt-1 text-xs text-muted">{health?.llm_model ?? "—"}</p>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {projects.length === 0 && !error ? (
        <p className="mt-10 text-muted">No projects yet. Measure a plot to create one.</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
              <Link href={`/projects/${project.id}`} className="block">
                <div className="relative h-36 bg-ink">
                  {project.screenshot_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tunnel/proxy URLs; not next/image remote config
                    <img
                      src={resolveMediaUrl(project.screenshot_url) ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone">
                      No preview
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-medium">
                    {project.name || project.land_units.display_label}
                  </p>
                  <p className="text-sm text-muted">
                    {project.land_units.display_label} ·{" "}
                    {project.selected_house?.style ?? "No house"} ·{" "}
                    {project.selected_house
                      ? formatPkr(project.selected_house.estimated_cost_pkr)
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {project.measurement_type === "ar" ? "AR measurement" : "Manual"} ·{" "}
                    {project.latest_report
                      ? `Report: ${project.latest_report.source}`
                      : "No report"}
                  </p>
                </div>
              </Link>
              <div className="flex gap-2 border-t border-ink/5 px-4 py-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm text-brass"
                >
                  Open
                </Link>
                <button
                  type="button"
                  disabled={busyId === project.id}
                  onClick={() => void removeProject(project.id)}
                  className="ml-auto text-sm text-red-700"
                >
                  {busyId === project.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
