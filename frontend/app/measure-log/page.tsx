"use client";

import { FormEvent, useEffect, useState } from "react";

type Trial = {
  recorded_at: string;
  true_area_m2: number;
  measured_area_m2: number;
  error_percent: number;
  device: string;
  notes: string;
};

const KEY = "plotline.cameraTrials";

function load(): Trial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toCsv(rows: Trial[]) {
  const header = "recorded_at,true_area_m2,measured_area_m2,error_percent,device,notes";
  const body = rows.map((row) =>
    [row.recorded_at, row.true_area_m2, row.measured_area_m2, row.error_percent, JSON.stringify(row.device), JSON.stringify(row.notes)].join(","),
  );
  return [header, ...body].join("\n");
}

export default function MeasureLogPage() {
  const [rows, setRows] = useState<Trial[]>([]);
  const [trueArea, setTrueArea] = useState("");
  const [measured, setMeasured] = useState("");
  const [device, setDevice] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setRows(load());
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const truth = Number(trueArea);
    const got = Number(measured);
    if (!(truth > 0) || !Number.isFinite(got)) return;
    const row: Trial = {
      recorded_at: new Date().toISOString(),
      true_area_m2: truth,
      measured_area_m2: got,
      error_percent: Number((((got - truth) / truth) * 100).toFixed(2)),
      device: device.trim() || "unspecified",
      notes: notes.trim(),
    };
    const next = [...rows, row];
    setRows(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    setTrueArea("");
    setMeasured("");
    setNotes("");
  }

  function download() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-camera-trials.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-serif text-3xl">AI camera trial log</h1>
      <p className="mt-2 text-sm text-muted">
        Write a row only after you have measured the same plot with a tape. This page starts empty.
        It does not invent trials.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label className="block text-sm">
          True area from the tape (m²)
          <input value={trueArea} onChange={(e) => setTrueArea(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Area the camera reported (m²)
          <input value={measured} onChange={(e) => setMeasured(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Device
          <input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="iPhone 13, Chrome" className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2" />
        </label>
        <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">Add this trial</button>
      </form>
      <p className="mt-6 text-sm">{rows.length === 0 ? "No trials recorded." : `${rows.length} trial(s) on this browser.`}</p>
      <button type="button" onClick={download} disabled={rows.length === 0} className="mt-3 rounded-full border border-ink/20 px-4 py-2 text-sm disabled:opacity-40">
        Download CSV
      </button>
    </main>
  );
}
