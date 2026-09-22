"use client";

import { createXRStore } from "@react-three/xr";

/**
 * v6 XR store. `true` = optional WebXR feature; `'required'` fails the session
 * if the phone cannot provide it. Headset-only features are turned off so
 * Android Chrome immersive-ar is more likely to start.
 */
export const xrStore = createXRStore({
  hitTest: "required",
  domOverlay: true,
  planeDetection: true,
  anchors: true,
  handTracking: false,
  bodyTracking: false,
  layers: false,
  meshDetection: false,
});
