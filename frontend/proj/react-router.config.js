import { vercelPreset } from "@vercel/react-router/vite";

/** @type {import('@react-router/dev/config').Config} */
export default {
  // Server-side render by default (set to false for SPA mode).
  ssr: true,
  // Emit Vercel's serverless build output when deployed on Vercel.
  presets: [vercelPreset()]
};
