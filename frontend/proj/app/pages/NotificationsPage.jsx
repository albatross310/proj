import { useEffect } from "react";
import { containerStyle, buttonStyle } from "../styles.js";
import { formatSubmitted } from "../messages.js";

export default function NotificationsPage({ menu, notifications, onBack, onMarkAllRead }) {
  // Mark all read as soon as this page is opened.
  useEffect(() => {
    if (notifications.some((n) => !n.read)) onMarkAllRead();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ textAlign: "center", marginTop: 100, fontSize: 24 }}>
      <div className="dc-card-page" style={containerStyle}>
        {menu}
        <h2 style={{ fontSize: 22 }}>
          <br /><br />Notifications
        </h2>
        {notifications.length === 0 ? (
          <p style={{ fontSize: 16, opacity: 0.6 }}>Nothing here yet.</p>
        ) : (
          <div style={{ textAlign: "left", fontSize: 15, margin: "16px 0" }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                className="dc-answer-card"
                style={{
                  padding: "10px 14px",
                  marginBottom: 10,
                  opacity: n.read ? 0.65 : 1,
                  borderLeft: n.read ? "none" : "3px solid #9a6700"
                }}
              >
                <div>{n.message}</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  {formatSubmitted(n.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="dc-button" style={buttonStyle} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
