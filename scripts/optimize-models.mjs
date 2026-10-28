#!/usr/bin/env node
/**
 * Optimize house GLBs with @gltf-transform/cli.
 * Prints before/after sizes. Mobile budget: <= 8 MB, prefer <= 150k tris.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "frontend/public/models/houses");

function kb(n) {
  return (n / 1024).toFixed(1);
}

if (!fs.existsSync(dir)) {
  console.error("Missing", dir);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".glb"));
if (!files.length) {
  console.error("No GLBs found. Run: python3 scripts/generate_house_glbs.py");
  process.exit(1);
}

console.log("Optimizing", files.length, "GLBs in", dir);
for (const file of files) {
  const fp = path.join(dir, file);
  const before = fs.statSync(fp).size;
  const tmp = fp + ".opt.glb";
  try {
    execSync(
      `npx --yes @gltf-transform/cli@4.1.1 optimize "${fp}" "${tmp}" --compress meshopt --texture-size 2048`,
      { stdio: "inherit", cwd: root },
    );
    if (fs.existsSync(tmp)) {
      fs.renameSync(tmp, fp);
      const after = fs.statSync(fp).size;
      console.log(
        `${file}: ${kb(before)} KB → ${kb(after)} KB (${(((after - before) / before) * 100).toFixed(1)}%)`,
      );
    }
  } catch (err) {
    console.warn(`optimize failed for ${file}:`, err.message || err);
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
console.log("Done.");
