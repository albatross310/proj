import { useState } from "react";
import { getSupabase } from "../supabaseClient.js";
import { containerStyle, buttonStyle, authInputStyle } from "../styles.js";

// Sign in / sign up + "forgot password", all via Supabase Auth. The session
// (and the `user` shown in the menu) is picked up by useAuth's auth listener,
// so on success we just navigate back with onDone().
export default function AccountPage({ menu, onDone }) {
  const [mode, setMode] = useState("password"); // password | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const supabase = getSupabase();

  // Sign in; if the account doesn't exist yet, create it (Supabase obscures
  // whether an email is registered, so a wrong password on an existing account
  // shows the "confirm your email" note too — the forgot-password link covers
  // that case).
  const submitPassword = async (e) => {
    e.preventDefault();
    setError("");
    setNote("");
    if (!supabase) return setError("Sign-in isn't configured yet.");
    setBusy(true);

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (!signInErr && data.session) {
      setBusy(false);
      return onDone();
    }
    if (signInErr && /invalid login credentials/i.test(signInErr.message)) {
      const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
        email,
        password
      });
      setBusy(false);
      if (signUpErr) return setError(signUpErr.message);
      if (signUp.session) return onDone(); // email confirmation disabled
      return setNote(
        "Almost there — check your email to confirm your account. " +
          "Already have one? Use “Forgot your password?”"
      );
    }
    setBusy(false);
    setError(signInErr ? signInErr.message : "Could not sign in.");
  };

  // Email a password-reset link that lands on /reset-password.
  const submitForgot = async (e) => {
    e.preventDefault();
    setError("");
    setNote("");
    if (!supabase) return setError("Sign-in isn't configured yet.");
    setBusy(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });
    setBusy(false);
    if (resetErr) return setError(resetErr.message);
    setNote("If that email has an account, a reset link is on its way.");
  };

  return (
    <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
      <div className="dc-card-page" style={containerStyle}>
        {menu}
        <br /><br />
        <h2>{mode === "password" ? "Sign in" : "Reset password"}</h2>

        {mode === "password" && (
          <form onSubmit={submitPassword}>
            <p style={{ fontSize: 16 }}>
              New here? Just pick a password to create your account.
            </p>
            <input
              type="email"
              autoFocus
              className="dc-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={authInputStyle}
            />
            <br />
            <input
              type="password"
              className="dc-input"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={authInputStyle}
            />
            <br />
            <button type="submit" className="dc-button" style={buttonStyle} disabled={busy}>
              {busy ? "…" : "Sign in"}
            </button>
            <p style={{ fontSize: 14, marginTop: 14 }}>
              <span
                className="dc-about-link"
                onClick={() => {
                  setError("");
                  setNote("");
                  setMode("forgot");
                }}
              >
                Forgot your password?
              </span>
            </p>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={submitForgot}>
            <p style={{ fontSize: 16 }}>
              Enter your email and we'll send you a reset link.
            </p>
            <input
              type="email"
              autoFocus
              className="dc-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={authInputStyle}
            />
            <br />
            <button type="submit" className="dc-button" style={buttonStyle} disabled={busy}>
              {busy ? "…" : "Send reset link"}
            </button>
            <p style={{ fontSize: 14, marginTop: 14 }}>
              <span className="dc-about-link" onClick={() => setMode("password")}>
                Back to sign in
              </span>
            </p>
          </form>
        )}

        {note && <p style={{ fontSize: 14, opacity: 0.8 }}>{note}</p>}
        {error && <p style={{ color: "red", fontSize: 14 }}>{error}</p>}
        <br />
        <button className="dc-button" style={buttonStyle} onClick={onDone}>
          Back
        </button>
      </div>
    </div>
  );
}
