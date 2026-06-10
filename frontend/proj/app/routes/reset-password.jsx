import { useEffect, useState } from "react";
import { getSupabase } from "../supabaseClient.js";
import { containerStyle, buttonStyle, authInputStyle } from "../styles.js";

export function meta() {
  return [
    { title: "Reset password — DotComma" },
    { name: "robots", content: "noindex" }
  ];
}

// Landing page for the Supabase password-reset email link. Supabase parses the
// recovery token from the URL (detectSessionInUrl) and establishes a temporary
// session; we then let the user set a new password via updateUser.
export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false); // recovery session present?
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Auth isn't configured.");
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const supabase = getSupabase();
    if (!supabase) return setError("Auth isn't configured.");
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) return setError(updErr.message);
    setDone(true);
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  };

  return (
    <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
      <div className="dc-card-page" style={containerStyle}>
        <br /><br />
        <h2>Set a new password</h2>
        {done ? (
          <p style={{ fontSize: 16 }}>Password updated — taking you back to the game…</p>
        ) : ready ? (
          <form onSubmit={submit}>
            <p style={{ fontSize: 16 }}>Choose a new password for your account.</p>
            <input
              type="password"
              autoFocus
              className="dc-input"
              placeholder="new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={authInputStyle}
            />
            <br />
            <button type="submit" className="dc-button" style={buttonStyle}>
              Update password
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 16 }}>
            Open this page from the reset link in your email.
          </p>
        )}
        {error && <p style={{ color: "red", fontSize: 14 }}>{error}</p>}
        <br />
        <p style={{ fontSize: 14 }}>
          <a className="dc-about-link" href="/">Back to DotComma</a>
        </p>
      </div>
    </div>
  );
}
