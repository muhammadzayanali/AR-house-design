"use client";

export type XRSupportStatus =
  | { kind: "checking" }
  | { kind: "supported" }
  | { kind: "insecure" }
  | { kind: "no-webxr" }
  | { kind: "no-ar" };

export async function detectImmersiveAR(): Promise<XRSupportStatus> {
  if (typeof window === "undefined") return { kind: "checking" };
  if (!window.isSecureContext) return { kind: "insecure" };
  if (!navigator.xr) return { kind: "no-webxr" };
  try {
    const ok = await navigator.xr.isSessionSupported("immersive-ar");
    return ok ? { kind: "supported" } : { kind: "no-ar" };
  } catch {
    return { kind: "no-ar" };
  }
}

export function supportMessage(status: XRSupportStatus) {
  switch (status.kind) {
    case "checking":
      return "Checking WebXR support…";
    case "supported":
      return "Android Chrome + ARCore detected. You can measure on the real plot.";
    case "insecure":
      return "WebXR needs HTTPS. Run npm run dev:https or use ngrok.";
    case "no-webxr":
      return "This browser has no WebXR. Use Android Chrome, or measure manually below.";
    case "no-ar":
      return "Immersive AR is not available (typical on iOS Safari). Use the manual plot form + 3D viewer.";
  }
}
