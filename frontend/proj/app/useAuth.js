import { useEffect, useState } from "react";
import { apiFetch, getToken, clearToken } from "./api.js";

// Owns the signed-in user: restores the session from the stored token on load,
// and exposes setUser (for sign-in/up/reset flows) and signOut.
export function useAuth() {
  const [user, setUser] = useState(null); // null = not signed in

  useEffect(() => {
    if (!getToken()) return;
    apiFetch("/api/me", { auth: true })
      .then((data) => setUser(data.user))
      .catch(() => clearToken()); // token invalid/expired — drop it
  }, []);

  const signOut = () => {
    if (getToken()) {
      apiFetch("/api/auth/signout", { method: "POST", auth: true }).catch(() => {});
    }
    clearToken();
    setUser(null);
  };

  return { user, setUser, signOut };
}
