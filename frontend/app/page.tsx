import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-brass">
            BS Computer Science FYP
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Measure the plot. Place the house. Walk around it.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Plotline is a web-based architectural planning assistant. Measure a
            plot with AI Camera (or manual L×W, or optional WebXR), convert the
            area to Marla/Kanal, match a catalog house with a rule-based engine,
            and inspect a true-to-scale 3D model. An LLM writes the client report
            from stored facts — never invents metres from photos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/ar"
              className="rounded-full bg-ink px-6 py-3 text-paper"
            >
              Open planner
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-ink/15 px-6 py-3"
            >
              Saved projects
            </Link>
          </div>
        </div>
        <ol className="space-y-4 rounded-3xl bg-white/50 p-6 ring-1 ring-ink/10">
          {[
            ["1. Measure", "AI Camera, Manual L×W, or optional WebXR. Area uses deterministic geometry (shoelace), not an LLM."],
            ["2. Recommend", "Plot size is matched to HouseDesign min/max ranges. No trained model."],
            ["3. Visualize", "Procedural 3D massing on the plot. Unsupported browsers get OrbitControls."],
            ["4. Narrate", "Llama or Qwen turns the saved JSON into a report and answers questions."],
          ].map(([title, body]) => (
            <li key={title}>
              <p className="font-serif text-xl">{title}</p>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
