export type PlotPoint = { x: number; z: number };

/** Ray-cast test on the XZ plane. Boundary points count as inside. */
export function pointInPolygon(x: number, z: number, polygon: PlotPoint[]) {
  if (polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const denom = b.z - a.z || 1e-12;
    const crosses = a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / denom + a.x;
    if (Math.abs(a.z - b.z) < 1e-9 && Math.abs(z - a.z) < 1e-6) {
      const minX = Math.min(a.x, b.x) - 1e-6;
      const maxX = Math.max(a.x, b.x) + 1e-6;
      if (x >= minX && x <= maxX) return true;
    }
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True when every corner of the yaw-rotated footprint sits inside the plot. */
export function footprintInside(
  polygon: PlotPoint[],
  offsetX: number,
  offsetZ: number,
  yaw: number,
  width: number,
  depth: number,
) {
  const hw = width / 2;
  const hd = depth / 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const corners: Array<[number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return corners.every(([x, z]) => {
    const rx = x * c - z * s + offsetX;
    const rz = x * s + z * c + offsetZ;
    return pointInPolygon(rx, rz, polygon);
  });
}
