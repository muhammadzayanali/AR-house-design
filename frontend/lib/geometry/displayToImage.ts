/**
 * Map overlay (CSS/display) pointer coordinates → native image pixel space.
 *
 * Critical for AI Camera Measurement: geometry must use the depth/working
 * image resolution, NOT clientWidth/devicePixelRatio pixels. object-fit
 * cover/contain both crop or letterbox — a naive rect×frameSize map is wrong.
 */

export type ObjectFitMode = "contain" | "cover";

export type DisplayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Convert a pointer position inside an overlay rect into image (x, y) pixels.
 * Returns null if the click lands in letterbox/pillarbox (contain only).
 */
export function displayToImageCoords(
  clientX: number,
  clientY: number,
  overlay: DisplayRect,
  imageWidth: number,
  imageHeight: number,
  objectFit: ObjectFitMode = "contain",
): { image_x: number; image_y: number } | null {
  if (
    !(overlay.width > 0) ||
    !(overlay.height > 0) ||
    !(imageWidth > 0) ||
    !(imageHeight > 0)
  ) {
    return null;
  }

  const nx = (clientX - overlay.left) / overlay.width;
  const ny = (clientY - overlay.top) / overlay.height;
  if (nx < 0 || ny < 0 || nx > 1 || ny > 1) return null;

  const imageAspect = imageWidth / imageHeight;
  const overlayAspect = overlay.width / overlay.height;

  let contentW: number;
  let contentH: number;
  if (objectFit === "contain") {
    if (overlayAspect > imageAspect) {
      // pillarbox: content height fills overlay
      contentH = overlay.height;
      contentW = contentH * imageAspect;
    } else {
      // letterbox: content width fills overlay
      contentW = overlay.width;
      contentH = contentW / imageAspect;
    }
  } else {
    // cover — content overflows and is clipped
    if (overlayAspect > imageAspect) {
      contentW = overlay.width;
      contentH = contentW / imageAspect;
    } else {
      contentH = overlay.height;
      contentW = contentH * imageAspect;
    }
  }

  const offsetX = (overlay.width - contentW) / 2;
  const offsetY = (overlay.height - contentH) / 2;
  const localX = nx * overlay.width - offsetX;
  const localY = ny * overlay.height - offsetY;

  if (objectFit === "contain") {
    if (localX < 0 || localY < 0 || localX > contentW || localY > contentH) {
      return null; // clicked letterbox
    }
  }

  const image_x = (localX / contentW) * imageWidth;
  const image_y = (localY / contentH) * imageHeight;
  return {
    image_x: clamp(image_x, 0, imageWidth - 1e-6),
    image_y: clamp(image_y, 0, imageHeight - 1e-6),
  };
}

/** Inverse: image pixel → fraction (0–1) within overlay for marker placement. */
export function imageToDisplayPercent(
  imageX: number,
  imageY: number,
  overlay: { width: number; height: number },
  imageWidth: number,
  imageHeight: number,
  objectFit: ObjectFitMode = "contain",
): { leftPct: number; topPct: number } {
  const imageAspect = imageWidth / imageHeight;
  const overlayAspect = overlay.width / overlay.height;
  let contentW: number;
  let contentH: number;
  if (objectFit === "contain") {
    if (overlayAspect > imageAspect) {
      contentH = overlay.height;
      contentW = contentH * imageAspect;
    } else {
      contentW = overlay.width;
      contentH = contentW / imageAspect;
    }
  } else if (overlayAspect > imageAspect) {
    contentW = overlay.width;
    contentH = contentW / imageAspect;
  } else {
    contentH = overlay.height;
    contentW = contentH * imageAspect;
  }
  const offsetX = (overlay.width - contentW) / 2;
  const offsetY = (overlay.height - contentH) / 2;
  const localX = (imageX / imageWidth) * contentW + offsetX;
  const localY = (imageY / imageHeight) * contentH + offsetY;
  return {
    leftPct: (localX / overlay.width) * 100,
    topPct: (localY / overlay.height) * 100,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Bounding box of a measured XZ polygon → house footprint (metres) + yaw.
 * Width = X extent, depth = Z extent after aligning the longest edge to +X.
 */
export function footprintFromWorldPolygon(
  points: Array<{ x: number; z: number }>,
): { width: number; depth: number; yaw: number; centerX: number; centerZ: number } {
  if (points.length < 3) {
    return { width: 10, depth: 10, yaw: 0, centerX: 0, centerZ: 0 };
  }
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cz = points.reduce((s, p) => s + p.z, 0) / points.length;

  // Longest edge → orientation
  let bestLen = 0;
  let yaw = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dz = points[j].z - points[i].z;
    const len = Math.hypot(dx, dz);
    if (len > bestLen) {
      bestLen = len;
      yaw = Math.atan2(dz, dx);
    }
  }

  const c = Math.cos(-yaw);
  const s = Math.sin(-yaw);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of points) {
    const dx = p.x - cx;
    const dz = p.z - cz;
    const u = dx * c - dz * s;
    const v = dx * s + dz * c;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const width = Math.max(0.5, maxU - minU);
  const depth = Math.max(0.5, maxV - minV);
  return { width, depth, yaw, centerX: cx, centerZ: cz };
}
