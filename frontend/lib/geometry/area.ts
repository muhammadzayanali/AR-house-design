/**
 * Plot area from AR hit-test corners.
 *
 * Points are Three.js world coordinates (y-up). We project onto the XZ
 * ground plane and ignore height, because the plot is a 2D land parcel.
 *
 * 2 points → treat as the diagonal of an axis-aligned rectangle on XZ
 * 3 points → triangle (shoelace)
 * 4 points → quadrilateral (shoelace). Tap corners in order around the plot.
 */
import type { WorldPoint } from "@/lib/types";

export function distanceXZ(a: WorldPoint, b: WorldPoint) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function perimeterXZ(points: WorldPoint[]) {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    sum += distanceXZ(points[i], points[i + 1]);
  }
  if (points.length >= 3) {
    sum += distanceXZ(points[points.length - 1], points[0]);
  }
  return sum;
}

export function areaSqmFromPoints(points: WorldPoint[]) {
  if (points.length < 2) return 0;
  if (points.length === 2) {
    const width = Math.abs(points[0].x - points[1].x);
    const depth = Math.abs(points[0].z - points[1].z);
    const area = width * depth;
    if (area > 0.5) return area;
    const span = distanceXZ(points[0], points[1]);
    return span * span;
  }
  return shoelaceXZ(points);
}

function shoelaceXZ(points: WorldPoint[]) {
  let acc = 0;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    acc += points[i].x * points[j].z;
    acc -= points[j].x * points[i].z;
  }
  return Math.abs(acc) / 2;
}
