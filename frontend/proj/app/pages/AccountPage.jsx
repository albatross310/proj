import { useState } from "react";
import { apiFetch, setToken } from "../api.js";
import { containerStyle, buttonStyle, authInputStyle } from "../styles.js";

// Sign in / sign up (email + password) with a forgot-password flow. Owns its
// own form state — it's reached fresh each time, so nothing needs to persist
// in App. `menu` is the shared <Menu> element; setUser/onDone come from App.
export default function AccountPage({ menu, setUser, onDone }) {
  const [mode, setMode] = useState("password"); // password | forgot | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Email + password: signs up, logs in, or sets a password on a legacy account.
  const submitPassword = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await apiFetch("/api/auth/password", {
        method: "POST",
        body: { email, password }
      });
      setToken(data.token);
      setUser(data.user);
      onDone();
    } catch (err) {
      setError(err.message || "Could not reach the server.");
    }
  };

  // Forgot password: request a reset code by email.
  const submitForgotStart = async (e) => {
    e.preventDefault();
    setError("");
    setNote("");
    try {
      await apiFetch("/api/auth/forgot/start", { method: "POST", body: { email } });
      setCode("");
      setPassword("");
      setMode("reset");
      setNote("If that email has an account, a reset code is on its way.");
    } catch (err) {
      setError(err.message || "Could not reach the server.");
    }
  };

  // Forgot password: set a new password using the emailed code.
  const submitForgotReset = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await apiFetch("/api/auth/forgot/reset", {
        method: "POST",
        body: { email, code, password }
      });
      setToken(data.token);
      setUser(data.user);
      onDone();
    } catch (err) {
      setError(err.message || "Could not reach the server.");
    }
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
            <button type="submit" className="dc-button" style={buttonStyle}>
              Sign in
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
          <form onSubmit={submitForgotStart}>
            <p style={{ fontSize: 16 }}>
              Enter your email and we'll send you a reset code.
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
            <button type="submit" className="dc-button" style={buttonStyle}>
              Send code
            </button>
            <p style={{ fontSize: 14, marginTop: 14 }}>
              <span className="dc-about-link" onClick={() => setMode("password")}>
                Back to sign in
              </span>
            </p>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={submitForgotReset}>
            <p style={{ fontSize: 16 }}>
              Enter the code from your email and a new password.
            </p>
            <input
              type="text"
              autoFocus
              inputMode="numeric"
              className="dc-input"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={authInputStyle}
            />
            <br />
            <input
              type="password"
              className="dc-input"
              placeholder="new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={authInputStyle}
            />
            <br />
            <button type="submit" className="dc-button" style={buttonStyle}>
              Set new password
            </button>
            <p style={{ fontSize: 14, marginTop: 14 }}>
              <span className="dc-about-link" onClick={() => setMode("forgot")}>
                Resend code
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
