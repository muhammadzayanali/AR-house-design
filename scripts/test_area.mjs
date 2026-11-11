import { readFileSync } from "node:fs";
import { assessPolygon, areaSqmFromPoints } from "../frontend/lib/geometry/area.ts";

function pt(x, z) {
  return { x, y: 0, z };
}
function rotate(x, z, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return pt(x * c - z * s, x * s + z * c);
}

const rect = [pt(0, 0), pt(10, 0), pt(10, 4), pt(0, 4)].map((p) => rotate(p.x, p.z, 0.4));
const rotated = assessPolygon(rect);
if (rotated.status !== "ok" || Math.abs(rotated.areaSqm - 40) > 1e-4) {
  throw new Error(`rotated rectangle failed: ${JSON.stringify(rotated)}`);
}
if (Math.abs(areaSqmFromPoints(rect) - 40) > 1e-4) throw new Error("area helper mismatch");

const bow = assessPolygon([pt(0, 0), pt(2, 2), pt(2, 0), pt(0, 2)]);
if (bow.status !== "self_intersecting" || bow.areaSqm !== 0) {
  throw new Error(`bow-tie failed: ${JSON.stringify(bow)}`);
}

const line = assessPolygon([pt(0, 0), pt(5, 0), pt(10, 0)]);
if (line.status !== "collinear" || line.areaSqm !== 0 || areaSqmFromPoints([pt(0, 0), pt(5, 0), pt(10, 0)]) === 100) {
  throw new Error(`collinear failed: ${JSON.stringify(line)}`);
}

const two = assessPolygon([pt(0, 0), pt(15, 0)]);
if (two.status !== "need_third_corner" || areaSqmFromPoints([pt(0, 0), pt(15, 0)]) !== 0) {
  throw new Error(`two points failed: ${JSON.stringify(two)}`);
}
if (!two.message.includes("length")) throw new Error("two-point message should point at length x width");

const picker = readFileSync(new URL("../frontend/components/architecture/StylePicker.tsx", import.meta.url), "utf8");
if (picker.includes("preliminary.estimate.bedrooms") || picker.includes("preliminary.estimate.bathrooms")) {
  throw new Error("style screen still shows a second bedroom or bathroom count");
}

console.log("frontend area and bedroom-count tests passed");
