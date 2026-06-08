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
        <Meta />
        <Links />
      </head>
      <body>
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
