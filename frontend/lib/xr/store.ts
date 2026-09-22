"use client";

import { createXRStore } from "@react-three/xr";
import type { WebGLRenderer } from "three";

type XRManager = WebGLRenderer["xr"];

/**
 * Mutable session init used by @pmndrs/xr when it builds its own request.
 * We prefer starting the session ourselves (see enterAndroidAR) so we fully
 * control features + DOM overlay root.
 *
 * Never use #plotline-ar-overlay as the DOM overlay root — it contains the
 * WebGL canvas and breaks Android Chrome session start.
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
  // Avoid auto offerSession racing our explicit Enter AR gesture.
  offerSession: false,
  enterGrantedSession: false,
});

let xrManager: XRManager | null = null;

const setManager = xrStore.setWebXRManager.bind(xrStore);
xrStore.setWebXRManager = (manager) => {
  xrManager = manager;
  try {
    manager.setReferenceSpaceType("local");
  } catch {
    /* ignore */
  }
  setManager(manager);
};

type SessionAttempt = {
  requiredFeatures: string[];
  optionalFeatures: string[];
  useDomOverlay: boolean;
  space: XRReferenceSpaceType;
};

const SESSION_ATTEMPTS: SessionAttempt[] = [
  {
    requiredFeatures: [],
    optionalFeatures: ["hit-test", "dom-overlay", "local", "local-floor"],
    useDomOverlay: true,
    space: "local",
  },
  {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay", "local"],
    useDomOverlay: true,
    space: "local",
  },
  {
    requiredFeatures: [],
    optionalFeatures: ["hit-test", "local"],
    useDomOverlay: false,
    space: "local",
  },
  {
    requiredFeatures: [],
    optionalFeatures: ["dom-overlay"],
    useDomOverlay: true,
    space: "local",
  },
  {
    requiredFeatures: [],
    optionalFeatures: [],
    useDomOverlay: false,
    space: "local",
  },
];

function overlayRoot(): Element {
  return xrStore.getState().domOverlayRoot ?? document.body;
}

function formatXrError(err: unknown): Error {
  if (err instanceof DOMException) {
    return new Error(`${err.name}: ${err.message}`);
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}

async function waitForXrManager(timeoutMs = 5000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (xrManager) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * Start immersive-ar via native requestSession, then hand the session to Three.
 * Falls back through soft feature sets for picky Android / ARCore phones.
 */
export async function enterAndroidAR() {
  if (typeof navigator === "undefined" || !navigator.xr) {
    throw new Error("WebXR not supported");
  }
  if (!window.isSecureContext) {
    throw new Error(
      "WebXR needs HTTPS. Open the Netlify site or use npm run dev:https — plain http://LAN IP cannot start AR.",
    );
  }

  const supported = await navigator.xr.isSessionSupported("immersive-ar");
  if (!supported) {
    throw new Error("Immersive AR is not supported on this browser/device");
  }

  await waitForXrManager();
  if (!xrManager) {
    throw new Error(
      "3D view was still loading. Wait 2 seconds and tap Enter AR again.",
    );
  }

  // End any stale session before retrying.
  try {
    const existing = xrManager.getSession?.();
    if (existing) await existing.end();
  } catch {
    /* ignore */
  }

  const root = overlayRoot();
  let lastError: unknown;

  for (const attempt of SESSION_ATTEMPTS) {
    const init: XRSessionInit = {
      requiredFeatures: [...attempt.requiredFeatures],
      optionalFeatures: [...attempt.optionalFeatures],
    };
    if (attempt.useDomOverlay) {
      init.domOverlay = { root };
    }

    // Keep pmndrs copy in sync (in case anything else reads it).
    androidArSessionInit.requiredFeatures = init.requiredFeatures;
    androidArSessionInit.optionalFeatures = init.optionalFeatures;
    if (init.domOverlay) androidArSessionInit.domOverlay = init.domOverlay;
    else delete androidArSessionInit.domOverlay;

    try {
      try {
        xrManager.setReferenceSpaceType(attempt.space);
      } catch {
        /* ignore */
      }

      const session = await navigator.xr.requestSession("immersive-ar", init);
      await xrManager.setSession(session);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  throw formatXrError(lastError ?? new Error("AR session could not start"));
}
