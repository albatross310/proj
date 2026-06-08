import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// The reactRouter() plugin provides React (incl. Fast Refresh); no separate
// @vitejs/plugin-react needed in framework mode.
export default defineConfig({
  plugins: [reactRouter()]
});
