// API base URL + helpers. Configure the backend with VITE_API_URL at build
// time; falls back to localhost in dev and the deployed Render service in prod.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000"
    : "https://proj-1o7w.onrender.com");

// The current Supabase access token. Kept here (set by useAuth as the session
// changes) so non-React callers like apiFetch can attach it synchronously.
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t || null; };
export const hasSession = () => !!accessToken;

// Authorization header object (empty when signed out) for fetch calls.
export const authHeaders = () =>
  accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

// fetch + JSON helper. Resolves to the parsed body; throws on non-2xx with the
// server's { error } message when present.
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
