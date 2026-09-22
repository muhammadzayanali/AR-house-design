"use client";

import { createXRStore } from "@react-three/xr";

/**
 * Minimal immersive-ar config for Android Chrome + ARCore.
 * Requesting hit-test as "required" or enabling plane/anchor extras
 * causes: "The specified session configuration is not supported"
 * on many phones. Optional hit-test still enables ground tapping.
 */
export const xrStore = createXRStore({
  hitTest: true,
  domOverlay: true,
  anchors: false,
  planeDetection: false,
  meshDetection: false,
  handTracking: false,
  bodyTracking: false,
  layers: false,
});
