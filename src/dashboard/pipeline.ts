import type { Opportunity } from "../types";

// The dashboard's Automation Pipeline stops at "sent_to_engineering" —
// "shipped" is the post-handoff, real-implementation state that Dashboard 2
// (explicitly out of scope) would own, so it never appears as a column here.
export const PIPELINE_STAGES = [
  "identified",
  "reviewed",
  "approved",
  "specced",
  "sent_to_engineering",
] as const satisfies readonly Opportunity["status"][];

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_LABELS: Record<PipelineStage, string> = {
  identified: "New",
  reviewed: "Reviewed",
  approved: "Approved",
  specced: "Specification Generated",
  sent_to_engineering: "Sent to Engineering",
};

export function stageLabel(stage: PipelineStage): string {
  return STAGE_LABELS[stage];
}

// null once an opportunity has reached the last pre-handoff stage — moving
// it further (to "shipped") happens once real implementation work lands,
// outside this pipeline.
export function nextStage(stage: Opportunity["status"]): PipelineStage | null {
  const index = PIPELINE_STAGES.indexOf(stage as PipelineStage);
  if (index === -1 || index === PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[index + 1];
}

export function advanceOpportunity(opportunity: Opportunity): Opportunity {
  const next = nextStage(opportunity.status);
  return next ? { ...opportunity, status: next } : opportunity;
}

export interface PipelineOpportunity {
  workflowId: string;
  stepId: string;
  name: string;
}

export interface PipelineColumn {
  stage: PipelineStage;
  label: string;
  opportunities: PipelineOpportunity[];
}

export function computeAutomationPipeline(registersByWorkflow: Record<string, Opportunity[]>): PipelineColumn[] {
  const columns: Record<PipelineStage, PipelineOpportunity[]> = {
    identified: [],
    reviewed: [],
    approved: [],
    specced: [],
    sent_to_engineering: [],
  };

  for (const [workflowId, opportunities] of Object.entries(registersByWorkflow)) {
    for (const o of opportunities) {
      if (o.status === "shipped") continue;
      columns[o.status as PipelineStage].push({ workflowId, stepId: o.stepId, name: o.label });
    }
  }

  return PIPELINE_STAGES.map((stage) => ({ stage, label: stageLabel(stage), opportunities: columns[stage] }));
}
