import type { AutomationBrief, Opportunity } from "../types";

const EFFORT_LABEL: Record<1 | 2 | 3, string> = {
  1: "Small — a few hours to a day",
  2: "Medium — a few days to a sprint",
  3: "Large — spans a sprint or more, likely needs design input",
};

function humanizeSignature(signature: string): string {
  return signature.replace(/_/g, " ");
}

// Deterministic, template-based — no LLM calls (weft-prd.md §6.8). Every
// field is derived only from what Weft actually observed (frequency,
// duration, system, the taxonomy-mapped intervention); it never invents
// specifics about the underlying system it wasn't told.
export function generateBrief(opportunity: Opportunity): AutomationBrief {
  const frequency = `${opportunity.occurrence}/${opportunity.totalSessions} recorded sessions`;
  const durationSec = (opportunity.avgDurationMs / 1000).toFixed(0);

  const problem =
    `"${opportunity.label}" in ${opportunity.system} is a ${humanizeSignature(opportunity.signature)} step` +
    `${opportunity.isCrossSystem ? ", crossing systems by hand," : ""} observed in ${frequency}, ` +
    `averaging ~${durationSec}s each time. It has no automation today.`;

  const trigger = `A workflow run reaches the "${opportunity.label}" step in ${opportunity.system}.`;

  const inputs =
    "Whatever this step currently reads from the on-screen form/state at that point in the workflow " +
    "(Weft records field identity only — role/label — never the values, so confirm exact field " +
    "contents with the team before building).";

  const outputs = `The outcome this step currently produces by hand — going forward, produced by: ${opportunity.intervention}.`;

  const systems = [opportunity.system];

  const approach = opportunity.suggestionText;

  const effortEstimate = EFFORT_LABEL[opportunity.effort];

  return {
    problem,
    trigger,
    inputs,
    outputs,
    systems,
    approach,
    effortEstimate,
    estimatedSavingHrs: opportunity.estimatedSavingHrs,
  };
}
