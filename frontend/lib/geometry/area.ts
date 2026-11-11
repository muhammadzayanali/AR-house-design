/**
 * Plot area from AR hit-test corners.
 *
 * Points are Three.js world coordinates (y-up). We project onto the XZ
 * ground plane and ignore height, because the plot is a 2D land parcel.
 *
 * 2 points are not a plot. Use length × width, or mark a third corner.
 * 3 or more points use the shoelace formula. Crossed or collinear corners are rejected.
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

export type PolygonStatus = "empty" | "need_third_corner" | "collinear" | "self_intersecting" | "ok";

export type PolygonAssessment = {
  status: PolygonStatus;
  areaSqm: number;
  message: string;
};

function cross(o: WorldPoint, a: WorldPoint, b: WorldPoint) {
  return (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
}

function segmentsCross(a: WorldPoint, b: WorldPoint, c: WorldPoint, d: WorldPoint) {
  const o1 = cross(a, b, c);
  const o2 = cross(a, b, d);
  const o3 = cross(c, d, a);
  const o4 = cross(c, d, b);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false;
  return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
}

function selfIntersects(points: WorldPoint[]) {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % n];
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(i - j) <= 1 || Math.abs(i - j) === n - 1) continue;
      const c = points[j];
      const d = points[(j + 1) % n];
      if (segmentsCross(a, b, c, d)) return true;
    }
  }
  return false;
}

/** Two points are not a plot. Length × width stays a separate manual entry. */
export function assessPolygon(points: WorldPoint[]): PolygonAssessment {
  if (points.length < 2) {
    return { status: "empty", areaSqm: 0, message: "Mark at least three corners." };
  }
  if (points.length === 2) {
    return {
      status: "need_third_corner",
      areaSqm: 0,
      message: "Two corners are not a plot. Mark a third corner, or use length × width.",
    };
  }
  if (selfIntersects(points)) {
    return {
      status: "self_intersecting",
      areaSqm: 0,
      message: "Those corners cross. Tap them in order around the boundary.",
    };
  }
  const area = shoelaceXZ(points);
  if (area < 0.05) {
    return {
      status: "collinear",
      areaSqm: 0,
      message: "Those corners are almost in a line. Walk the boundary, not a single edge.",
    };
  }
  return { status: "ok", areaSqm: area, message: "" };
}

export function areaSqmFromPoints(points: WorldPoint[]) {
  return assessPolygon(points).areaSqm;
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
