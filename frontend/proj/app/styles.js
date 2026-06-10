// Static inline-style objects shared across pages. Hoisted to module scope so
// they're allocated once rather than rebuilt on every render.

export const containerStyle = {
  width: "100%",
  maxWidth: 500,
  margin: "0 auto",
  padding: "0 20px",
  minHeight: 500,
  position: "relative"
};

export const boxStyle = {
  width: "100%",
  minHeight: 60,
  padding: 10,
  boxSizing: "border-box",
  textAlign: "center"
};

export const buttonRowStyle = {
  display: "flex",
  justifyContent: "center",
  gap: 15,
  marginTop: 30
};

export const buttonStyle = {
  padding: "10px 20px",
  fontSize: 16,
  cursor: "pointer",
  minWidth: 120
};

export const menuItemStyle = {
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 16
};

export const authInputStyle = {
  fontSize: 18,
  padding: "8px 12px",
  textAlign: "center",
  width: 260,
  margin: "10px 0"
};

// Word colour for the live type-box / results: green = valid, teal =
// punctuation, red = off-list. Used as the local fallback; live play prefers
// the server's validation when the socket has answered.
export function colorFor(token, allowedWords) {
  if (/^[a-z]+$/i.test(token)) {
    return allowedWords.has(token.toLowerCase()) ? "#15803d" : "#e11d48";
  }
  if ([".", ",", "?"].includes(token)) return "#0e9aa7";
  return "#e11d48";
}
