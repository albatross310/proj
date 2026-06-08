import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from "react-router";
import "./index.css";
import "./App.css";

export function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#1f8a5b" />
        <Meta />
        <Links />
      </head>
      <body>
        <h1
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
            border: 0
          }}
        >
          DotComma — a constrained-language game for writing in short, plain words
        </h1>
        <div id="root">{children}</div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

export function ErrorBoundary({ error }) {
  const message = error?.statusText || error?.message || "Something went wrong.";
  return (
    <main style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
      <h1>DotComma</h1>
      <p>{message}</p>
    </main>
  );
}
