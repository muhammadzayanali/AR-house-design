import Link from "next/link";

import catalog from "@/lib/houses/manifest.json";

type Entry = {
  id: string;
  name: string;
  style: string;
  license: string;
  source: string;
  attribution: string;
  triangles?: number;
  file_size_kb?: number;
  generated?: boolean;
};

export default function CreditsPage() {
  const entries = (catalog as { models: Entry[] }).models || [];

  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-paper px-4 py-10 text-ink">
      <Link href="/" className="text-sm text-brass">
        ← Plotline
      </Link>
      <h1 className="mt-4 font-serif text-3xl">3D model credits</h1>
      <p className="mt-2 text-sm text-muted">
        House visuals are either project-generated architectural massing (Three.js) or
        CC0 / CC-BY assets. Nothing is presented as a photoreal survey scan. Licenses
        below are recorded for academic honesty.
      </p>

      <div className="mt-8 overflow-x-auto rounded-2xl ring-1 ring-black/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-ink/5 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Design</th>
              <th className="px-3 py-2">Style</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">License</th>
              <th className="px-3 py-2">Size</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((m) => (
              <tr key={m.id} className="border-t border-black/5">
                <td className="px-3 py-2 font-medium">
                  {m.name}
                  {m.generated ? (
                    <span className="mt-0.5 block text-[10px] font-normal text-muted">
                      Generated massing model
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{m.style}</td>
                <td className="px-3 py-2">{m.source}</td>
                <td className="px-3 py-2">
                  {m.license}
                  {m.attribution ? (
                    <span className="mt-0.5 block text-[10px] text-muted">{m.attribution}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted">
                  {m.file_size_kb != null ? `${m.file_size_kb} KB` : "—"}
                  {m.triangles != null ? ` · ~${m.triangles.toLocaleString()} tris` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-10 space-y-2 text-sm text-muted">
        <h2 className="font-serif text-xl text-ink">Environment / tools</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>drei Environment presets (apartment) for PBR reflections in the desktop viewer.</li>
          <li>Draco / meshopt decoders self-hosted under <code>/public/draco</code> (Three.js).</li>
          <li>Reference look for Modern: <code>docs/reference/house-reference.png</code> (not shipped as a model).</li>
        </ul>
      </section>
    </main>
  );
}
