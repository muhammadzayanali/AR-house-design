import { Euler, Quaternion, Vector3 } from "three";

const DEG = Math.PI / 180;
const _euler = new Euler();
const _zee = new Vector3(0, 0, 1);
const _q0 = new Quaternion();
const _q1 = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

/**
 * Device orientation → camera quaternion.
 * Same axis order as the old three.js DeviceOrientationControls
 * (YXZ, then a -90° X tilt, then screen rotation). Implemented here
 * because that control is not part of current Three.js.
 */
export function quaternionFromDeviceOrientation(
  alphaDeg: number | null,
  betaDeg: number | null,
  gammaDeg: number | null,
  screenAngleDeg: number,
  out: Quaternion,
) {
  const alpha = (alphaDeg ?? 0) * DEG;
  const beta = (betaDeg ?? 0) * DEG;
  const gamma = (gammaDeg ?? 0) * DEG;
  const orient = screenAngleDeg * DEG;
  _euler.set(beta, alpha, -gamma, "YXZ");
  out.setFromEuler(_euler);
  out.multiply(_q1);
  out.multiply(_q0.setFromAxisAngle(_zee, -orient));
  return out;
}

export function screenOrientationAngle() {
  if (typeof screen !== "undefined" && typeof screen.orientation?.angle === "number") {
    return screen.orientation.angle;
  }
  const legacy = (typeof window !== "undefined" ? (window as Window & { orientation?: number }).orientation : 0) ?? 0;
  return legacy;
}

export async function requestMotionPermission(): Promise<"granted" | "denied" | "na"> {
  const ctor = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<PermissionState | string>;
  };
  if (typeof ctor.requestPermission !== "function") return "na";
  try {
    const result = await ctor.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** Low-pass on the orientation quaternion. Call once per frame. */
export class OrientationFilter {
  private latest = new Quaternion();
  private state = new Quaternion();
  private hasLatest = false;
  private ready = false;

  setReading(
    alphaDeg: number | null,
    betaDeg: number | null,
    gammaDeg: number | null,
    screenAngleDeg: number,
  ) {
    quaternionFromDeviceOrientation(alphaDeg, betaDeg, gammaDeg, screenAngleDeg, this.latest);
    this.hasLatest = true;
  }

  /** `blend` is 0–1. Use 1 when the user prefers reduced motion. */
  tick(out: Quaternion, blend: number) {
    if (!this.hasLatest) return false;
    if (!this.ready) {
      this.state.copy(this.latest);
      this.ready = true;
    } else {
      this.state.slerp(this.latest, Math.min(1, Math.max(0.02, blend)));
    }
    out.copy(this.state);
    return true;
  }
}
