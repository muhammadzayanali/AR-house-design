/**
 * Media proxy target check.
 * Only an http(s) URL whose path is under /media/ on DJANGO_ORIGIN is fetched.
 * Redirects to another host, or to a path outside /media/, are refused.
 */

export function mediaUpstream(origin: string, segments: readonly string[]): URL | null {
  if (!origin || !segments?.length) return null;
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    return null;
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") return null;
  if (base.username || base.password) return null;
  for (const segment of segments) {
    if (typeof segment !== "string" || segment.length === 0) return null;
    if (segment === "." || segment === "..") return null;
    if (/[\\/?#]/.test(segment)) return null;
  }
  const url = new URL(`${base.origin}/media/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`);
  if (url.origin !== base.origin) return null;
  if (!url.pathname.startsWith("/media/")) return null;
  if (url.pathname.split("/").some((part) => part === "." || part === "..")) return null;
  return url;
}

export function redirectStaysOnMedia(current: URL, location: string): URL | null {
  if (!location) return null;
  let next: URL;
  try {
    next = new URL(location, current);
  } catch {
    return null;
  }
  if (next.origin !== current.origin) return null;
  if (next.username || next.password) return null;
  if (next.search || next.hash) return null;
  if (next.pathname.split("/").some((part) => part === "." || part === "..")) return null;
  if (!next.pathname.startsWith("/media/") || next.pathname === "/media/") return null;
  return next;
}

type MediaResponse = {
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type MediaFetch = (
  input: string,
  init: { redirect: "manual"; headers: Record<string, string>; cache: "no-store" },
) => Promise<MediaResponse>;

export type MediaProxyResult =
  | { ok: true; status: 200; body: ArrayBuffer; contentType: string }
  | { ok: false; status: number; message: string };

export async function fetchMedia(
  origin: string,
  segments: readonly string[],
  doFetch: MediaFetch,
): Promise<MediaProxyResult> {
  const first = mediaUpstream(origin, segments);
  if (!first) return { ok: false, status: 400, message: "Rejected media path" };
  let current = first;
  for (let hop = 0; hop < 3; hop += 1) {
    const res = await doFetch(current.toString(), {
      redirect: "manual",
      cache: "no-store",
      headers: {
        "Bypass-Tunnel-Reminder": "true",
        "User-Agent": "PlotlineMediaProxy/1.0",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = redirectStaysOnMedia(current, res.headers.get("location") || "");
      if (!next) return { ok: false, status: 502, message: "Rejected media redirect" };
      current = next;
      continue;
    }
    if (res.status === 0 || res.status !== 200) {
      return {
        ok: false,
        status: res.status === 0 ? 502 : res.status,
        message: res.status === 0 ? "Rejected media redirect" : `Upstream ${res.status}`,
      };
    }
    return {
      ok: true,
      status: 200,
      body: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  }
  return { ok: false, status: 502, message: "Rejected media redirect" };
}
