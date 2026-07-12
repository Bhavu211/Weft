import type { StepSignature } from "./types";

export interface TaxonomyEntry {
  intervention: string;
  effort: 1 | 2 | 3;
  impact: 1 | 2 | 3;
  isOpportunity: boolean;
  isBottleneck: boolean;
  automatableFraction: number; // 0-1, used in savings.ts
  suggestionText: string;
}

// Deterministic signature -> intervention/effort/impact/savings mapping.
// No LLM calls in this build (see weft-prd.md §6.8). Values come from the
// taxonomy table in BUILD.md — do not tune these without updating that table.
const TAXONOMY: Record<StepSignature, TaxonomyEntry> = {
  entry: {
    intervention: "Keep manual",
    effort: 1,
    impact: 1,
    isOpportunity: false,
    isBottleneck: false,
    automatableFraction: 0,
    suggestionText: "Entry step — keep manual; not an automation target.",
  },
  repetitive: {
    intervention: "RPA / scripted automation",
    effort: 2,
    impact: 2,
    isOpportunity: true,
    isBottleneck: false,
    automatableFraction: 0.9,
    suggestionText:
      "This step repeats the same mechanical action every run — a strong RPA / scripted-automation candidate.",
  },
  copy_between_systems: {
    intervention: "Integration / API bridge",
    effort: 2,
    impact: 3,
    isOpportunity: true,
    isBottleneck: false,
    automatableFraction: 0.95,
    suggestionText:
      "Data is copied by hand between systems here — an API/integration bridge would remove this step almost entirely.",
  },
  lookup_verification: {
    intervention: "Automated validation",
    effort: 2,
    impact: 3,
    isOpportunity: true,
    isBottleneck: false,
    automatableFraction: 0.8,
    suggestionText: "This is a lookup/verification check — a strong candidate for automated validation.",
  },
  judgment_text: {
    intervention: "LLM assist",
    effort: 3,
    impact: 3,
    isOpportunity: true,
    isBottleneck: false,
    automatableFraction: 0.5,
    suggestionText:
      "This step involves reading and judging free text — an LLM-assist draft could speed this up, with a human still deciding.",
  },
  wait_handoff: {
    intervention: "Process redesign (not tech)",
    effort: 1,
    impact: 3,
    isOpportunity: false,
    isBottleneck: true,
    automatableFraction: 0,
    suggestionText:
      "This is a wait/handoff bottleneck, not an automation target — fix it by redesigning the process, not by scripting it.",
  },
  approval_decision: {
    intervention: "Policy automation + routing",
    effort: 3,
    impact: 2,
    isOpportunity: true,
    isBottleneck: false,
    automatableFraction: 0.6,
    suggestionText:
      "This is a rule-bound approval — policy automation with routing could clear most of these without a human touch.",
  },
  exception_branch: {
    intervention: "Exception handling / triage",
    effort: 3,
    impact: 3,
    isOpportunity: true,
    isBottleneck: false,
    automatableFraction: 0.6,
    suggestionText:
      "This path only shows up in a minority of sessions — worth an explicit exception-handling/triage rule rather than folding it into the main path.",
  },
};

export function taxonomyFor(signature: StepSignature): TaxonomyEntry {
  return TAXONOMY[signature];
}
