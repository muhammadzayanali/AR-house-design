"use client";

import { createXRStore } from "@react-three/xr";

/**
 * Mutable session init — @pmndrs/xr defaults to requiredFeatures: ['local-floor'],
 * which many Android Chrome/ARCore phones reject with:
 * "The specified session configuration is not supported."
 *
 * We override with Android-friendly features and retry softer configs on enter.
 */
export const androidArSessionInit: XRSessionInit = {
  requiredFeatures: ["hit-test"],
  optionalFeatures: ["dom-overlay", "local-floor", "local"],
};

export const xrStore = createXRStore({
  customSessionInit: androidArSessionInit,
  hitTest: true,
  domOverlay: true,
  anchors: false,
  planeDetection: false,
  meshDetection: false,
  handTracking: false,
  bodyTracking: false,
  layers: false,
});

const SESSION_ATTEMPTS: XRSessionInit[] = [
  {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay", "local-floor", "local"],
  },
  {
    requiredFeatures: [],
    optionalFeatures: ["hit-test", "dom-overlay", "local-floor", "local"],
  },
  {
    requiredFeatures: ["local"],
    optionalFeatures: ["hit-test", "dom-overlay", "local-floor"],
  },
];

function overlayRoot(): Element {
  return (
    document.getElementById("plotline-ar-overlay") ??
    document.body
  );
}

/** Start immersive-ar with fallbacks for picky Android WebXR implementations. */
export async function enterAndroidAR() {
  const root = overlayRoot();
  let lastError: unknown;

  for (const attempt of SESSION_ATTEMPTS) {
    androidArSessionInit.requiredFeatures = [...(attempt.requiredFeatures ?? [])];
    androidArSessionInit.optionalFeatures = [...(attempt.optionalFeatures ?? [])];
    androidArSessionInit.domOverlay = { root };

    try {
      await xrStore.enterAR();
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AR session could not start on this device");
}
