import type { AutomationBrief, Opportunity } from "../types";

function ticketTitle(opportunity: Opportunity): string {
  return `Automate: ${opportunity.label}`;
}

export function exportBriefJson(opportunity: Opportunity, brief: AutomationBrief): string {
  return JSON.stringify(
    {
      title: ticketTitle(opportunity),
      system: opportunity.system,
      intervention: opportunity.intervention,
      effort: opportunity.effort,
      impact: opportunity.impact,
      brief,
    },
    null,
    2
  );
}

const CHECKLIST_TEMPLATE = (opportunity: Opportunity): string[] => [
  "Confirm the exact field contents/values this step touches (Weft doesn't store them)",
  `Implement: ${opportunity.intervention}`,
  "Wire up the trigger described below",
  "Verify the automated output matches the current manual outcome",
  "Ship it and record the realized saving in Weft's ROI tracker",
];

// Jira/Linear-ready Markdown: a title, a description built from the brief,
// and an acceptance-style checklist — pasteable straight into either tool
// (weft-prd.md FR-12). No live API push; this is the whole MVP export.
export function exportBriefMarkdown(opportunity: Opportunity, brief: AutomationBrief): string {
  const lines = [
    `# ${ticketTitle(opportunity)}`,
    "",
    `**Systems:** ${brief.systems.join(", ")}`,
    `**Effort:** ${brief.effortEstimate}`,
    `**Estimated saving:** ${brief.estimatedSavingHrs.toFixed(1)} hrs/month`,
    "",
    "## Problem",
    brief.problem,
    "",
    "## Trigger",
    brief.trigger,
    "",
    "## Inputs",
    brief.inputs,
    "",
    "## Outputs",
    brief.outputs,
    "",
    "## Recommended approach",
    brief.approach,
    "",
    "## Acceptance checklist",
    ...CHECKLIST_TEMPLATE(opportunity).map((item) => `- [ ] ${item}`),
  ];

  return lines.join("\n");
}
