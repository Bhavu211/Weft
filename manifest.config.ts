import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Weft",
  version: "0.0.1",
  description: "Records real work, reconstructs the true workflow, and finds where automation belongs. Runs entirely locally.",
  permissions: ["storage", "sidePanel"],
  icons: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  action: {
    default_icon: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
    default_title: "Open Weft",
  },
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
  // The Process Intelligence dashboard (Dashboard 1) is a full-tab page, not
  // part of the side panel — a dashboard's executive-summary/KPI-grid
  // layouts need real screen width. Declaring it here (rather than only
  // linking to it) is what gets @crxjs/vite-plugin to bundle it as a build
  // input at all, since nothing else in the manifest references it.
  web_accessible_resources: [
    {
      resources: ["src/dashboard/index.html"],
      matches: ["<all_urls>"],
    },
  ],
});
