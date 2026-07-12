import type { ClassifiedStep, Step, StepSignature } from "../types";

const WAIT_THRESHOLD_MS = 5 * 60 * 1000; // idle gap before the next step reads as a handoff wait
const REPEAT_THRESHOLD = 3; // same step recurring this many times in a session reads as a loop

const APPROVAL_WORDS = ["approve", "reject", "authorize", "decision"];
const EXCEPTION_WORDS = ["cancel", "error", "exception", "escalate", "retry"];
const LOOKUP_WORDS = ["search", "verify", "lookup", "check", "find"];

function matchesAny(label: string, words: string[]): boolean {
  return words.some((word) => label.includes(word));
}

function baseSignature(step: Step): StepSignature {
  if (step.durationMs >= WAIT_THRESHOLD_MS) return "wait_handoff";

  const label = (step.label ?? "").toLowerCase();
  const events = step.events ?? [];
  const hasInput = events.some((e) => e.type === "input");
  const hasInputOrSubmit = events.some((e) => e.type === "input" || e.type === "submit");

  if (step.isCrossSystem && hasInputOrSubmit) return "copy_between_systems";
  if (matchesAny(label, APPROVAL_WORDS)) return "approval_decision";
  if (matchesAny(label, EXCEPTION_WORDS)) return "exception_branch";
  if (matchesAny(label, LOOKUP_WORDS)) return "lookup_verification";

  const hasTextarea = events.some((e) => e.type === "input" && e.element?.tag === "textarea");
  if (hasTextarea) return "judgment_text";
  if (hasInput) return "entry";
  return "entry";
}

function stepKey(step: Step): string {
  return `${step.domain}|${step.urlPath}|${step.label}`;
}

// Classifies each step in isolation first, then promotes any step that
// recurs REPEAT_THRESHOLD+ times in the session to "repetitive" — unless it
// already carries a more specific signal (wait/copy/approval/lookup/etc),
// which always takes priority.
export function classify(steps: Step[]): ClassifiedStep[] {
  const counts = new Map<string, number>();
  for (const step of steps) {
    const key = stepKey(step);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return steps.map((step) => {
    const signature = baseSignature(step);
    const recurs = (counts.get(stepKey(step)) ?? 0) >= REPEAT_THRESHOLD;
    return { ...step, signature: signature === "entry" && recurs ? "repetitive" : signature };
  });
}
