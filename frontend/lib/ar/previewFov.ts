/**
 * Match a Three.js camera to a video shown with object-fit: cover.
 * Sizes are native video pixels and CSS element pixels. Do not treat
 * CSS pixels as the camera sensor.
 *
 * `horizontalFovDeg` is the field of view of what is actually on screen
 * (the visible crop), not the full sensor. The slider defaults to 60.
 */

export function visiblePerspective(
  videoWidth: number,
  videoHeight: number,
  elementWidth: number,
  elementHeight: number,
  horizontalFovDeg: number,
) {
  const vidW = Math.max(videoWidth, 1);
  const vidH = Math.max(videoHeight, 1);
  const elW = Math.max(elementWidth, 1);
  const elH = Math.max(elementHeight, 1);
  const cover = Math.max(elW / vidW, elH / vidH);
  const visibleNativeWidth = elW / cover;
  const visibleNativeHeight = elH / cover;
  const aspect = elW / elH;
  const hFov = (horizontalFovDeg * Math.PI) / 180;
  const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
  return {
    aspect,
    fovDeg: (vFov * 180) / Math.PI,
    visibleNativeWidth,
    visibleNativeHeight,
    cropped: visibleNativeWidth < vidW - 1 || visibleNativeHeight < vidH - 1,
  };
}

/** Horizontal angle subtended by a real width at a known distance. */
export function subtendedHorizontalDeg(widthM: number, distanceM: number) {
  const d = Math.max(distanceM, 0.001);
  return (2 * Math.atan(widthM / 2 / d) * 180) / Math.PI;
}

/**
 * How far back the camera must stand so the whole building fits.
 * Distance is to the house centre. The front face, porch, width, and
 * height all have to land inside the frame, with a small margin.
 */
export function fitStandOff(
  widthM: number,
  depthM: number,
  heightM: number,
  horizontalFovDeg: number,
  aspect = 1.5,
) {
  const hFov = (Math.min(100, Math.max(30, horizontalFovDeg)) * Math.PI) / 180;
  const vFov = 2 * Math.atan(Math.tan(hFov / 2) / Math.max(aspect, 0.45));
  const margin = 1.35;
  const distW = ((Math.max(widthM, 4) / 2) * margin) / Math.tan(hFov / 2);
  const distH = ((Math.max(heightM, 3) / 2) * margin) / Math.tan(vFov / 2);
  const front = Math.max(depthM, 4) / 2 + 2.5;
  return Math.min(56, Math.max(10, Math.max(distW, distH) + front));
}
