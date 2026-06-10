// Playful results-page titles, cycled each round so they alternate, plus the
// submitted-time formatter for the "other players wrote" list.

export const WIN_MESSAGES = [
  "Sweet as! 🌴",
  "Clean as a creek! 🌿",
  "Crystal clear! 🌊",
  "You little ripper! ✨",
  "Smooth sailing! ⛵"
];

export const LOSE_MESSAGES = [
  "So close — paddle back out! 🌊",
  "Almost — catch the next wave! 🏄",
  "Nearly! Dust off the sand. 🏖️",
  "Not quite — have another crack! 🐨",
  "Give it another go! 🌴"
];

// UTC timestamp ("2026-06-07 16:10:24" or ISO "2026-06-07T16:10:24.000Z")
// -> "07/06/26 7pm" in local time (rounded to the nearest hour).
export function formatSubmitted(createdAt) {
  if (!createdAt) return "";
  const iso = createdAt.includes("T")
    ? createdAt
    : createdAt.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  let h = d.getHours();
  if (d.getMinutes() >= 30) h = (h + 1) % 24; // nearest hour
  const ampm = h >= 12 ? "pm" : "am";
  const hr = h % 12 || 12;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy} ${hr}${ampm}`;
}
