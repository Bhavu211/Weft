import type { CapturedEvent } from "../types";
import type { CaptureEventMessage } from "../background/messages";
import { redactText } from "./redact";

const INTERACTIVE_SELECTOR = "a, button, [role], input, select, textarea";

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

document.addEventListener(
  "click",
  (e) => {
    const target = (e.target as Element)?.closest(INTERACTIVE_SELECTOR);
    send(buildEvent("click", target ?? (e.target as Element)));
  },
  { capture: true }
);

document.addEventListener(
  "input",
  (e) => {
    send(buildEvent("input", e.target as Element));
  },
  { capture: true }
);

document.addEventListener(
  "submit",
  (e) => {
    send(buildEvent("submit", e.target as Element));
  },
  { capture: true }
);

send(buildEvent("navigation", null));

console.log("[Weft] content script injected on", window.location.hostname);
