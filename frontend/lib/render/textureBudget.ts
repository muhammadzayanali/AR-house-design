/** Uncompressed RGBA8 plus a full mip chain (about 4/3 of the top level). */

export const PBR_MAP_COUNT = 18;

export function rgbaMipMB(width: number, height: number, count = 1) {
  const bytes = width * height * 4 * (4 / 3) * count;
  return bytes / (1024 * 1024);
}

export const TEXTURE_TIER_MB = {
  "webp-1k": rgbaMipMB(1024, 1024, PBR_MAP_COUNT),
  "webp-512": rgbaMipMB(512, 512, PBR_MAP_COUNT),
};

export const PHONE_TEXTURE_BUDGET_MB = 40;

export function phoneClient() {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

/** Phones use 512 px maps unless the 1K set is within the phone budget. */
export function textureTierForDevice(): "webp-1k" | "webp-512" {
  if (TEXTURE_TIER_MB["webp-1k"] <= PHONE_TEXTURE_BUDGET_MB) return "webp-1k";
  return phoneClient() ? "webp-512" : "webp-1k";
}
