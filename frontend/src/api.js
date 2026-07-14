// Delulu API client — one place for all fetches, always attaches bearer if present.
import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "delulu.session.token";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const API = BASE ? `${BASE}/api` : "/api";

async function getToken() {
  return await storage.secureGet(TOKEN_KEY, null);
}

export async function setToken(token) {
  if (!token) return storage.secureRemove(TOKEN_KEY);
  return storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  return storage.secureRemove(TOKEN_KEY);
}

async function request(method, path, body, extraHeaders) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json", ...(extraHeaders || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { detail: text };
  }
  if (!res.ok) {
    // FastAPI returns validation errors as a list of {loc, msg, ...} objects.
    // Normalize into a human-readable string so callers can always render it.
    let detailStr;
    if (Array.isArray(json.detail)) {
      detailStr = json.detail.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(", ");
    } else if (json.detail && typeof json.detail === "object") {
      detailStr = json.detail.msg || JSON.stringify(json.detail);
    } else {
      detailStr = json.detail || `HTTP ${res.status}`;
    }
    const err = new Error(String(detailStr));
    err.status = res.status;
    err.detail = detailStr;
    throw err;
  }
  return json;
}

export const api = {
  get: (p, extraHeaders) => request("GET", p, undefined, extraHeaders),
  post: (p, b, extraHeaders) => request("POST", p, b, extraHeaders),
  put: (p, b, extraHeaders) => request("PUT", p, b, extraHeaders),
  del: (p, extraHeaders) => request("DELETE", p, undefined, extraHeaders),
};

// Convenience wrappers
export const authApi = {
  signup: (email, password, displayName) => api.post("/auth/signup", { email, password, displayName }),
  login: (email, password) => api.post("/auth/login", { email, password }),
  emergent: (session_token) => api.post("/auth/emergent", { session_token }),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout", {}),
};

export const storyApi = {
  list: () => api.get("/stories"),
  get: (id) => api.get(`/stories/${id}`),
  choice: (payload) => api.post("/progress/choice", payload),
  updateProgress: (payload) => api.post("/progress", payload),
  completeChapter: (payload) => api.post("/chapters/complete", payload),
  unlockChapter: (payload) => api.post("/chapters/unlock", payload),
  skipTimer: (payload) => api.post("/chapters/skip-timer", payload),
  recordEnding: (payload) => api.post("/endings/record", payload),
  shareEnding: (payload) => api.post("/endings/share", payload).catch(() => ({})),
  cast: (payload) => api.post("/story/cast", payload),
};

export const identityApi = {
  get: () => api.get("/users/identity"),
  save: (payload) => api.post("/users/identity", payload),
};

export const adminApi = {
  _pass: null,
  setPass(pass) { this._pass = pass; },
  _headers() { return this._pass ? { "X-Admin-Pass": this._pass } : {}; },
  listStories() { return api.get("/admin/stories", this._headers()); },
  validateStory(id) { return api.get(`/admin/stories/${id}/validate`, this._headers()); },
  preview(payload) { return api.post("/admin/preview", payload, this._headers()); },
};

// (no other request-level hooks needed)

export const avatarApi = {
  catalog: () => api.get("/avatar/catalog"),
  presets: () => api.get("/avatar/presets"),
  setConfig: (layers, displayName) => api.put("/avatar/config", { layers, displayName }),
  setPreset: (presetId, displayName) => api.put("/avatar/preset", { presetId, displayName }),
  saveLook: (name, layers) => api.post("/avatar/looks", { name, layers }),
  deleteLook: (id) => api.del(`/avatar/looks/${id}`),
  buyItem: (itemId) => api.post("/avatar/buy-item", { itemId }),
};

export const gemsApi = {
  packs: (currency) => api.get(`/gems/packs${currency ? `?currency=${currency}` : ""}`),
  daily: () => api.post("/gems/daily-claim", {}),
  buyMock: (packId) => api.post("/gems/buy-mock", { packId }),
};

export const analyticsApi = {
  track: (event, props = {}) => api.post("/analytics", { event, props }).catch(() => {}),
};
