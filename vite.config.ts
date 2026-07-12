import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    // The dashboard page isn't referenced by any manifest key crxjs treats as
    // an HTML entry point (it's only listed under web_accessible_resources,
    // which just gets it copied verbatim into dist, unprocessed). Declaring
    // it as a rollup input is what actually gets its <script>/<link> tags
    // bundled the same way the side panel's index.html is.
    rollupOptions: {
      input: {
        dashboard: "src/dashboard/index.html",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
