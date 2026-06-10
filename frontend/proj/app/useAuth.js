import { useEffect, useState } from "react";
import { apiFetch, setAccessToken } from "./api.js";
import { getSupabase } from "./supabaseClient.js";

// Tracks the Supabase Auth session. Stores the access token (so apiFetch can
// attach it) and loads the display-name profile from our backend's /api/me.
export function useAuth() {
  const [user, setUser] = useState(null); // null = not signed in

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    // Apply a session change: stash the token, then load the profile. If the
    // backend is unreachable, fall back to a soft display so the UI still
    // reflects the signed-in state.
    const applySession = async (session) => {
      const token = session?.access_token || null;
      setAccessToken(token);
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const data = await apiFetch("/api/me", { auth: true });
        setUser(data.user);
      } catch {
        setUser({ email: session.user?.email || null, displayName: "Player" });
      }
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      applySession(session)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setAccessToken(null);
    setUser(null);
  };

  return { user, setUser, signOut };
}
