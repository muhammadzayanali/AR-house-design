"use client";

import { createXRStore } from "@react-three/xr";

/**
 * Mutable session init — @pmndrs/xr defaults to requiredFeatures: ['local-floor'],
 * which many Android Chrome/ARCore phones reject with:
 * "The specified session configuration is not supported."
 *
 * IMPORTANT: use the store's own domOverlayRoot (a dedicated body child).
 * Do NOT pass #plotline-ar-overlay — that node contains the WebGL canvas and
 * breaks DOM Overlay / session start on Android Chrome.
 */
export const androidArSessionInit: XRSessionInit = {
  requiredFeatures: [],
  optionalFeatures: ["hit-test", "dom-overlay", "local", "local-floor"],
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

// Prefer `local` over `local-floor` — Three.js defaults to local-floor and that
// fails on some ARCore devices even when immersive-ar is reported as supported.
const setManager = xrStore.setWebXRManager.bind(xrStore);
xrStore.setWebXRManager = (manager) => {
  try {
    manager.setReferenceSpaceType("local");
  } catch {
    /* older three.js */
  }
  setManager(manager);
};

type SessionAttempt = {
  requiredFeatures: string[];
  optionalFeatures: string[];
  useDomOverlay: boolean;
};

const SESSION_ATTEMPTS: SessionAttempt[] = [
  {
    requiredFeatures: [],
    optionalFeatures: ["hit-test", "dom-overlay", "local", "local-floor"],
    useDomOverlay: true,
  },
  {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay", "local", "local-floor"],
    useDomOverlay: true,
  },
  {
    requiredFeatures: [],
    optionalFeatures: ["hit-test", "local", "local-floor"],
    useDomOverlay: false,
  },
  {
    requiredFeatures: ["local"],
    optionalFeatures: ["hit-test", "dom-overlay"],
    useDomOverlay: true,
  },
  {
    requiredFeatures: [],
    optionalFeatures: [],
    useDomOverlay: false,
  },
];

function overlayRoot(): Element {
  const fromStore = xrStore.getState().domOverlayRoot;
  if (fromStore) return fromStore;
  return document.body;
}

async function waitForXrManager(timeoutMs = 4000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    try {
      // enterAR rejects immediately with "not connected" if manager is missing;
      // we probe via a no-op: if navigator.xr exists and canvas XR is wired,
      // the store's internal manager is set by <XR> on first render.
      // Soft check: canvas WebGL XR flag.
      const canvas = document.querySelector("canvas");
      const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
      // R3F attaches xr on the renderer, not the raw context — presence of canvas is enough signal.
      if (canvas && canvas.width > 0) return;
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Start immersive-ar with fallbacks for picky Android WebXR implementations. */
export async function enterAndroidAR() {
  if (typeof navigator === "undefined" || !navigator.xr) {
    throw new Error("WebXR not supported");
  }
  const supported = await navigator.xr.isSessionSupported("immersive-ar");
  if (!supported) {
    throw new Error("Immersive AR is not supported on this browser/device");
  }

  await waitForXrManager();

  const root = overlayRoot();
  let lastError: unknown;

  for (const attempt of SESSION_ATTEMPTS) {
    androidArSessionInit.requiredFeatures = [...attempt.requiredFeatures];
    androidArSessionInit.optionalFeatures = [...attempt.optionalFeatures];
    if (attempt.useDomOverlay) {
      androidArSessionInit.domOverlay = { root };
    } else {
      delete androidArSessionInit.domOverlay;
    }

    try {
      await xrStore.enterAR();
      return;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Canvas / <XR> not ready yet — brief pause then continue attempts
      if (/not connected to three\.js|canvas is not yet loaded/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AR session could not start on this device");
}
