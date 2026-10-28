#!/usr/bin/env node
/**
 * Verify each house GLB bounding box spans at least the metadata footprint
 * (site slabs may be larger). Fail if main span is wildly wrong.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "frontend/lib/houses/manifest.json"), "utf8"),
);

let failed = 0;
for (const m of manifest.models) {
  const glbPath = path.join(root, "frontend/public", m.glb.replace(/^\//, ""));
  if (!fs.existsSync(glbPath)) {
    console.error("MISSING", m.id, glbPath);
    failed++;
    continue;
  }
  const span = m.bbox_span_m;
  const meta = m.footprint_m;
  if (!span) {
    console.error("NO_BBOX", m.id, "— re-run generate_house_glbs.py");
    failed++;
    continue;
  }
  // Generated models include a site slab ~+2–3 m; require span >= footprint
  const okW = span.width >= meta.width * 0.98;
  const okD = span.depth >= meta.depth * 0.98;
  // And not absurdly larger than 2× footprint + 6 m slab
  const okMaxW = span.width <= meta.width * 2 + 6;
  const okMaxD = span.depth <= meta.depth * 2 + 6;
  const ok = okW && okD && okMaxW && okMaxD;
  console.log(
    `${ok ? "OK" : "FAIL"} ${m.id}: meta ${meta.width}×${meta.depth} span ${span.width}×${span.depth} tris=${m.triangles} ${m.file_size_kb}KB`,
  );
  if (!ok) failed++;
}
if (failed) {
  console.error(`\n${failed} model(s) failed bbox check`);
  process.exit(1);
}
console.log("\nAll models passed bbox checks.");
