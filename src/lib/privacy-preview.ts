import type { ClassifiedStep } from "../types";

export interface PrivacyPreviewStep {
  id: string;
  order: number;
  label: string;
  system: string; // domain + urlPath, for display only
  durationMs: number;
}

export const REDACTED_LABEL = "[redacted]";

// What the user is shown before a session is confirmed: step labels, the
// system each step touched, and how long it took — nothing else. Never pull
// in raw event fields here; that would defeat the point of a privacy preview.
export function buildPrivacyPreview(steps: ClassifiedStep[]): PrivacyPreviewStep[] {
  return steps.map((step) => ({
    id: step.id,
    order: step.order,
    label: step.label,
    system: step.domain + step.urlPath,
    durationMs: step.durationMs,
  }));
}

// Applies user-chosen label overrides (from redacting or hand-editing a step
// label in the preview) onto the session's steps before it's confirmed.
export function applyLabelEdits(
  steps: ClassifiedStep[],
  edits: Record<string, string>
): ClassifiedStep[] {
  return steps.map((step) => (step.id in edits ? { ...step, label: edits[step.id] } : step));
}
