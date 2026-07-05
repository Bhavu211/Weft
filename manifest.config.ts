import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Weft",
  version: "0.0.1",
  description: "Records real work, reconstructs the true workflow, and finds where automation belongs. Runs entirely locally.",
  permissions: ["storage", "sidePanel"],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/capture.ts"],
      run_at: "document_idle",
    },
  ],
});
