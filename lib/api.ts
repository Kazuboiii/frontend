import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_KEY = "api_base_url";

/**
 * Deployment-time API endpoint. Set NEXT_PUBLIC_API_BASE_URL to the public
 * origin (for example https://api.example.com) or to a full /api/v1 URL.
 * When unset, the app uses same-origin "/api/v1", which works with the
 * development proxy or a reverse proxy in production.
 */
const ENV_API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();

function normalizeConfiguredBase(value: string): string {
  const base = value.trim().replace(/\/+$/, "");
  if (!base) return "/api/v1";
  if (base === "/api/v1") return base;
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Server URL must be an HTTP(S) URL without credentials, query or fragment.");
  }
  return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
}

function getApiBase(): string {
  // Deployment configuration wins over old browser settings.
  if (ENV_API_BASE) return normalizeConfiguredBase(ENV_API_BASE);
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_ALLOW_API_OVERRIDE === "true") {
    const stored = localStorage.getItem(API_KEY);
    if (stored?.trim()) return normalizeConfiguredBase(stored);
  }
  return "/api/v1";
}

function endSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  localStorage.removeItem("auth_api_base");
  localStorage.removeItem("selected_division");
  if (window.location.pathname !== "/login") window.location.href = "/login";
}

function buildApiClient(baseURL: string) {
  const options = { baseURL, timeout: 20000, headers: { "Content-Type": "application/json" } };
  const api = axios.create(options);
  const auth = axios.create(options); // No interceptors: refresh must never recurse.
  let refreshing: Promise<string> | null = null;

  api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (token && !["/auth/login/", "/auth/logout/", "/auth/refresh/"].includes(config.url ?? "")) {
      if (localStorage.getItem("auth_api_base") !== baseURL) {
        endSession();
        throw new Error("The authentication server changed. Please sign in again.");
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const config = error.config as (InternalAxiosRequestConfig & { retried?: boolean }) | undefined;
      if (error.response?.status !== 401 || !config || typeof window === "undefined" ||
          ["/auth/login/", "/auth/logout/", "/auth/refresh/"].includes(config.url ?? "")) throw error;
      if (config.retried) { endSession(); throw error; }
      const refresh = localStorage.getItem("refresh_token");
      if (!refresh) { endSession(); throw error; }
      config.retried = true;
      // A concurrent request may have already refreshed this token.
      let access = localStorage.getItem("access_token");
      if (!access || config.headers.Authorization === `Bearer ${access}`) {
        if (!refreshing) {
          refreshing = auth.post("/auth/refresh/", { refresh }).then(({ data }) => {
            // Do not resurrect a logged-out session or overwrite a new login.
            if (localStorage.getItem("refresh_token") !== refresh) throw new Error("Session changed.");
            localStorage.setItem("access_token", data.access);
            if (data.refresh) localStorage.setItem("refresh_token", data.refresh);
            return data.access as string;
          }).finally(() => { refreshing = null; });
        }
        try { access = await refreshing; }
        catch (refreshError) {
          if (axios.isAxiosError(refreshError) && [400, 401, 403].includes(refreshError.response?.status ?? 0) &&
              localStorage.getItem("refresh_token") === refresh) endSession();
          throw refreshError;
        }
      }
      config.headers.Authorization = `Bearer ${access}`;
      return api.request(config);
    },
  );
  return api;
}

let currentApi = buildApiClient(getApiBase());

function refreshApi() {
  const base = getApiBase();
  if (base !== currentApi.defaults.baseURL) endSession();
  currentApi = buildApiClient(base);
}

export { currentApi as api, getApiBase, refreshApi, API_KEY };

export type { AxiosError };

// Follow page numbers on our own origin, never a server-supplied absolute URL.
export async function listAll<T = Record<string, any>>(path: string, params = {}): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 1000; page++) {
    const { data } = await currentApi.get(path, { params: { ...params, page } });
    if (Array.isArray(data)) return data;
    if (!Array.isArray(data.results)) throw new Error("Unexpected list response.");
    rows.push(...data.results);
    if (!data.next) return rows;
  }
  throw new Error("Too many results. Narrow the selection.");
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data?.detail === "string") return data.detail;
    if (data && typeof data === "object") return Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join("; ");
    return error.response ? `Request failed (${error.response.status}).` : "Cannot reach the laptop. Check that both devices are on the same network and the server is running.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
