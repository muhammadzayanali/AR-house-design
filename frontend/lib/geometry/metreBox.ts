import { BoxGeometry } from "three";

/** Box UVs in metres, so a repeating texture tiles by real size. */
export function metreBoxGeometry(width: number, height: number, depth: number) {
  const geometry = new BoxGeometry(width, height, depth);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i += 1) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    if (nx >= ny && nx >= nz) uv.setXY(i, position.getZ(i), position.getY(i));
    else if (ny >= nz) uv.setXY(i, position.getX(i), position.getZ(i));
    else uv.setXY(i, position.getX(i), position.getY(i));
  }
  uv.needsUpdate = true;
  return geometry;
}
