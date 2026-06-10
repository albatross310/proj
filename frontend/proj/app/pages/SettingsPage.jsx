import { useState } from "react";
import { apiFetch } from "../api.js";
import { containerStyle, buttonStyle } from "../styles.js";

// Display-name + preferences. Owns its own form state. `hideRevealToggle` is an
// App-level preference (it also affects the game page), so it's passed in.
export default function SettingsPage({
  menu,
  user,
  setUser,
  onBack,
  hideRevealToggle,
  setHideRevealToggle
}) {
  const [nameDraft, setNameDraft] = useState(user ? user.displayName : "");
  const [note, setNote] = useState("");

  const saveName = async (e) => {
    e.preventDefault();
    setNote("");
    try {
      const data = await apiFetch("/api/me/display-name", {
        method: "POST",
        auth: true,
        body: { displayName: nameDraft }
      });
      setUser(data.user);
      setNote("Saved!");
    } catch (err) {
      setNote(err.message || "Could not reach the server.");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
      <div className="dc-card-page" style={containerStyle}>
        {menu}
        <br /><br />
        <h2>Settings</h2>
        {user ? (
          <form onSubmit={saveName}>
            <p style={{ fontSize: 16 }}>
              Display name — shown next to your public answers.
            </p>
            <input
              className="dc-input"
              value={nameDraft}
              maxLength={30}
              onChange={(e) => setNameDraft(e.target.value)}
              style={{ fontSize: 18, padding: "8px 12px", textAlign: "center", width: 260, margin: "10px 0" }}
            />
            <br />
            <button type="submit" className="dc-button" style={buttonStyle}>
              Save
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 16 }}>Sign in to change your display name.</p>
        )}
        {note && <p style={{ fontSize: 14, opacity: 0.8 }}>{note}</p>}
        <br />
        <label className="dc-switch" style={{ fontSize: 15 }}>
          <input
            type="checkbox"
            checked={!hideRevealToggle}
            onChange={(e) => {
              const show = e.target.checked;
              setHideRevealToggle(!show);
              localStorage.setItem("dotcomma_hide_reveal_toggle", show ? "" : "1");
            }}
          />
          <span className="track" />
          Show the Progressive Reveal switch on game pages
        </label>
        <br /><br />
        <button className="dc-button" style={buttonStyle} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
