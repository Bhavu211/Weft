import type { CapturedEvent } from "../types";
import type { CaptureEventMessage } from "../background/messages";
import { redactText } from "./redact";

// Only genuine widget/control roles — never structural or data-bearing ones
// (row, gridcell, cell, table, grid, list, region, article, ...). A bare
// "[role]" selector would treat a data-grid row or cell as "the interactive
// element" for a click that lands inside it, and the textContent fallback
// in getLabel() below would then capture that cell's actual value — exactly
// the "page-content text from data regions" capture is never supposed to
// touch (weft-prd.md FR-3). Scoping to roles that represent a specific
// action a person takes, not a container of data, closes that hole.
const INTERACTIVE_ROLES = [
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "option",
  "combobox",
  "textbox",
  "searchbox",
  "slider",
  "spinbutton",
];

const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  ...INTERACTIVE_ROLES.map((role) => `[role="${role}"]`),
].join(", ");

function getRole(el: Element): string {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit;

  const tag = el.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (tag === "input") {
    const type = (el as HTMLInputElement).type;
    return type === "submit" || type === "button" ? "button" : "textbox";
  }
  return "generic";
}

// Reads only element identity (aria-label, associated <label>, placeholder, or
// visible text) — never the field's value — and redacts the result before it
// ever leaves this function.
function getLabel(el: Element): string {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return redactText(ariaLabel.trim());

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl?.textContent) return redactText(labelEl.textContent.trim());
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl?.textContent) return redactText(labelEl.textContent.trim());
    }
    const placeholder = "placeholder" in el ? (el as HTMLInputElement).placeholder : "";
    if (placeholder) return redactText(placeholder.trim());
  }

  const text = el.textContent?.trim();
  if (text) return redactText(text.slice(0, 80));

  return "";
}

function buildEvent(type: CapturedEvent["type"], target: Element | null): CapturedEvent {
  return {
    id: crypto.randomUUID(),
    ts: Date.now(),
    type,
    domain: window.location.hostname,
    urlPath: window.location.pathname, // query string intentionally stripped
    element: target
      ? { role: getRole(target), label: getLabel(target), tag: target.tagName.toLowerCase() }
      : { role: "document", label: "", tag: "document" },
  };
}

function send(event: CapturedEvent): void {
  const message: CaptureEventMessage = { type: "CAPTURE_EVENT", event };
  chrome.runtime.sendMessage(message).catch(() => {
    // no active session listening (or panel context torn down) — drop silently
  });
}

// Event targets are virtually always Elements, but a defensive check avoids
// a crash if some target ever turns out to be a Document/Text/other node.
function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

document.addEventListener(
  "click",
  (e) => {
    // If the click didn't land on (or inside) a genuine interactive
    // control, don't fall back to the raw click target — that target could
    // be a data-grid cell, a table row, or any other element whose
    // textContent is exactly the page-content this is never supposed to
    // read. No interactive ancestor means no label, not "use whatever was
    // clicked."
    const el = asElement(e.target);
    send(buildEvent("click", el?.closest(INTERACTIVE_SELECTOR) ?? null));
  },
  { capture: true }
);

document.addEventListener(
  "input",
  (e) => {
    send(buildEvent("input", asElement(e.target)));
  },
  { capture: true }
);

document.addEventListener(
  "submit",
  (e) => {
    send(buildEvent("submit", asElement(e.target)));
  },
  { capture: true }
);

// SPA route changes (pushState/replaceState/back-forward) don't reload the
// page, so a screen the user never directly interacts with — e.g. an
// auto-advancing verification-result screen — would otherwise never produce
// a captured event carrying its own urlPath, and segment.ts would never see
// that boundary. Emit a synthetic navigation event whenever the path changes.
let lastUrlPath = window.location.pathname;

function notifyIfPathChanged(): void {
  if (window.location.pathname !== lastUrlPath) {
    lastUrlPath = window.location.pathname;
    send(buildEvent("navigation", null));
  }
}

// Some pages freeze or otherwise lock down `history` (frameworks that guard
// against exactly this kind of patching); reassigning pushState/replaceState
// there throws and would abort this entire content script before any
// listeners attach. Never let that take down capture.
try {
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args: Parameters<History["pushState"]>) {
    originalPushState(...args);
    notifyIfPathChanged();
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function (...args: Parameters<History["replaceState"]>) {
    originalReplaceState(...args);
    notifyIfPathChanged();
  };
} catch (err) {
  console.error("[Weft] could not patch history for SPA navigation detection", err);
}

window.addEventListener("popstate", notifyIfPathChanged);

send(buildEvent("navigation", null));

console.log("[Weft] content script injected on", window.location.hostname);
