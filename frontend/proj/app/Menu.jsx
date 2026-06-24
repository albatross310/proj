import { menuItemStyle } from "./styles.js";

// Top-right ☰ menu, shown on every page. stopPropagation so menu clicks don't
// advance the intro/game reveals. The open/close + click-away state lives in
// App; the action handlers are passed in.
export default function Menu({
  user,
  menuOpen,
  setMenuOpen,
  menuNote,
  setMenuNote,
  menuRef,
  onSignIn,
  onSettings,
  onMyAnswers,
  onNotifications,
  unreadCount,
  onResetProgress,
  onSignOut
}) {
  return (
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "absolute", top: 10, right: 10, textAlign: "right", zIndex: 10 }}
    >
      {user && unreadCount > 0 && (
        <button
          aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
          onClick={onNotifications}
          style={{
            fontSize: 18,
            background: "none",
            border: "none",
            cursor: "pointer",
            marginRight: 4,
            position: "relative"
          }}
        >
          🔔
          <span style={{
            position: "absolute",
            top: -4,
            right: -4,
            background: "#e11d48",
            color: "#fff",
            borderRadius: "50%",
            fontSize: 10,
            minWidth: 16,
            height: 16,
            lineHeight: "16px",
            textAlign: "center",
            padding: "0 3px",
            fontStyle: "normal"
          }}>
            {unreadCount}
          </span>
        </button>
      )}
      <button
        aria-label="Menu"
        onClick={() => {
          setMenuOpen((o) => !o);
          setMenuNote("");
        }}
        style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer" }}
      >
        ☰
      </button>
      {menuOpen && (
        <div className="dc-menu-panel" style={{ textAlign: "left", minWidth: 190 }}>
          {user ? (
            <div style={{ ...menuItemStyle, cursor: "default", opacity: 0.7, fontSize: 14 }}>
              Signed in as <b>{user.displayName}</b>
            </div>
          ) : (
            <div className="dc-menu-item" style={menuItemStyle} onClick={onSignIn}>
              Sign in
            </div>
          )}
          <div className="dc-menu-item" style={menuItemStyle} onClick={onSettings}>
            Settings
          </div>
          <div className="dc-menu-item" style={menuItemStyle} onClick={onMyAnswers}>
            My answers
          </div>
          <div className="dc-menu-item" style={menuItemStyle} onClick={onResetProgress}>
            Reset local progress
          </div>
          {user && (
            <div className="dc-menu-item" style={menuItemStyle} onClick={onSignOut}>
              Sign out
            </div>
          )}
          {menuNote && (
            <p style={{ fontSize: 13, opacity: 0.6, padding: "0 14px 8px", margin: 0 }}>
              {menuNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
