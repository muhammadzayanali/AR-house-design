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
            Plotline is a web-based architectural planning assistant. Scan a
            vacant plot on your phone, convert the area to Marla/Kanal, match a
            catalog house with a rule-based engine, and inspect a true-to-scale
            3D model through the camera. An LLM writes the client report from
            stored facts — never from photos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/ar"
              className="rounded-full bg-ink px-6 py-3 text-paper"
            >
              Open AR planner
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
            ["1. Measure", "Tap 2–4 ground corners with WebXR hit-testing. Area is vector geometry on the XZ plane."],
            ["2. Recommend", "Plot size is matched to HouseDesign min/max ranges. No trained model."],
            ["3. Visualize", "A .glb massing sits on the real plot. Unsupported browsers get OrbitControls."],
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
