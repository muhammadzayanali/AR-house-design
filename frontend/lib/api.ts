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
  const response = await fetch(resolveApiUrl(path), { ...init, headers });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(formatApiError(data, response.status), response.status, data);
  }
  return data as T;
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

/** Local Django when frontend is hosted on Netlify (browser → laptop LAN). */
function resolveApiUrl(path: string) {
  const normalized = normalizeApiPath(path);
  if (!normalized.startsWith("/api/") && !normalized.startsWith("/media/")) {
    return normalized;
  }
  const origin = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/$/, "");
  return origin ? `${origin}${normalized}` : normalized;
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
