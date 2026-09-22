import type { AuthUser } from "@/lib/types";

const TOKEN_KEY = "plotline.token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Token ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = resolveApiUrl(path);
  // localtunnel interstitial returns 511 HTML unless this header is set
  if (/loca\.lt/i.test(url)) {
    headers.set("Bypass-Tunnel-Reminder", "true");
  }

  try {
    const response = await fetch(url, { ...init, headers });
    if (response.status === 204) return undefined as T;
    const text = await response.text();

    if (
      response.status === 511 ||
      /tunnel website ahead|network authentication required/i.test(text)
    ) {
      throw new ApiError(
        "API tunnel blocked (loca.lt reminder page). Redeploy after the Bypass-Tunnel-Reminder fix, or open http://YOUR_LAN_IP:3000 on the same Wi‑Fi instead of Netlify.",
        511,
        null,
      );
    }

    if (response.status === 502 || response.status === 503) {
      throw new ApiError(
        "API tunnel is down or overloaded (502/503). On the laptop keep Django + localtunnel running, then retry — or open http://192.168.2.105:3000 on the same Wi‑Fi.",
        response.status,
        text.slice(0, 200),
      );
    }

    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(
          `API returned non-JSON (${response.status}). Is the Django tunnel still running?`,
          response.status,
          text.slice(0, 200),
        );
      }
    }
    if (!response.ok) {
      throw new ApiError(formatApiError(data, response.status), response.status, data);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new ApiError(
        "Failed to reach the API. Keep Django + the HTTPS tunnel running on your laptop, or use http://YOUR_LAN_IP:3000 on the same Wi‑Fi.",
        0,
        null,
      );
    }
    throw err;
  }
}

function formatApiError(data: unknown, status: number) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    if (Array.isArray(record.non_field_errors)) {
      return record.non_field_errors.join(" ");
    }
    const parts = Object.entries(record).map(([key, value]) => {
      const msg = Array.isArray(value) ? value.join(", ") : String(value);
      return `${key}: ${msg}`;
    });
    if (parts.length) return parts.join(" · ");
  }
  return `Request failed (${status})`;
}

function normalizeApiPath(path: string) {
  if (!path.startsWith("/api/")) return path;
  const [pathname, query] = path.split("?");
  const slashed = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return query ? `${slashed}?${query}` : slashed;
}

/** Local Django when frontend is hosted on Netlify (browser → HTTPS tunnel). */
export function resolveApiUrl(path: string) {
  const normalized = normalizeApiPath(path);
  if (!normalized.startsWith("/api/") && !normalized.startsWith("/media/")) {
    return normalized;
  }
  const origin = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/$/, "");
  return origin ? `${origin}${normalized}` : normalized;
}

/** Screenshots / media from Django (often relative `/media/...`). */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  let pathname = url;
  if (/^https?:\/\//i.test(url)) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return url;
    }
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  const origin = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/$/, "");

  // localtunnel interstitial blocks bare <img> GETs (no Bypass header).
  // Same-origin Next proxy adds the header server-side.
  if (origin && /loca\.lt/i.test(origin) && pathname.startsWith("/media/")) {
    return `/api/media-proxy/${pathname.slice("/media/".length)}`;
  }

  return resolveApiUrl(pathname);
}

export async function loginRequest(username: string, password: string) {
  return api<{ token: string; user: AuthUser }>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function registerRequest(
  username: string,
  password: string,
  email: string,
) {
  return api<{ token: string; user: AuthUser }>("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify({ username, password, email }),
  });
}
