// API base URL + token/session helpers, in one place.
// Configure the backend with VITE_API_URL at build time; falls back to
// localhost in dev and the deployed Render service in production.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000"
    : "https://proj-1o7w.onrender.com");

const TOKEN_KEY = "dotcomma_token";

const hasStorage = () => typeof localStorage !== "undefined";

export const getToken = () => (hasStorage() ? localStorage.getItem(TOKEN_KEY) : null);
export const setToken = (t) => hasStorage() && localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => hasStorage() && localStorage.removeItem(TOKEN_KEY);

// Authorization header object (empty when signed out) for fetch calls.
export const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// fetch + JSON helper. Resolves to the parsed body; throws on non-2xx with
// the server's { error } message when present.
export async function apiFetch(path, { method = "GET", body, auth = false } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(auth ? authHeaders() : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
