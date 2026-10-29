/**
 * Pose source for placing a house on a phone.
 * The 3D house is shared. Only the camera pose implementation changes.
 *
 * WebXRPoseProvider does not compute a pose. The immersive session,
 * hit-test, and anchors in lib/xr/store.ts and AnchoredHouse stay the
 * source of truth and are not reimplemented here.
 */

export type PoseMode = "webxr" | "camera-preview" | "experimental";

export interface PoseProvider {
  readonly id: PoseMode;
  readonly label: string;
}

export class WebXRPoseProvider implements PoseProvider {
  readonly id = "webxr" as const;
  readonly label = "WebXR";
}

export class GyroPoseProvider implements PoseProvider {
  readonly id = "camera-preview" as const;
  readonly label = "Camera preview";
}

/** Not loaded. AlvaAR was not validated on a phone, so the WASM stays out. */
export class SlamPoseProvider implements PoseProvider {
  readonly id = "experimental" as const;
  readonly label = "Experimental";
  readonly available = false;
  readonly reason =
    "AlvaAR (GPLv3) was not run on a phone over HTTPS, so experimental tracking is not loaded. Placement stays on camera preview.";
}
