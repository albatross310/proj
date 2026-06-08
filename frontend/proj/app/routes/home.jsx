import App from "../App.jsx";

export function meta() {
  const title = "DotComma — a constrained-language game";
  const description =
    "DotComma is a playful language game: solve lines using only short, " +
    "plain words. The onboarding layer for a low-friction bridge-language " +
    "community.";
  const url = "https://dotcomma.vercel.app/";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description }
  ];
}

export default function Home() {
  return <App />;
}
