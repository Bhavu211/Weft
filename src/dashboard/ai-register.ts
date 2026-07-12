import type { Opportunity, StepSignature, Thumb } from "../types";

export type OpportunityCategory =
  | "Repetitive"
  | "Copy-Paste"
  | "Approval"
  | "Manual Decision"
  | "Exception Handling"
  | "Data Entry"
  | "Search"
  | "Communication";

// OCR has no reachable mapping below — nothing in taxonomy.ts's StepSignature
// set carries a "this step handles a scanned document/image" signal, so
// claiming an OCR recommendation for any of them would be fabricated
// confidence rather than something grounded in what was actually observed.
export type AICapability =
  | "LLM"
  | "OCR"
  | "RPA"
  | "API Integration"
  | "Agentic AI"
  | "Knowledge Retrieval"
  | "Workflow Automation";

export type Level = "Low" | "Medium" | "High";

const CATEGORY_BY_SIGNATURE: Record<StepSignature, OpportunityCategory> = {
  entry: "Data Entry",
  repetitive: "Repetitive",
  copy_between_systems: "Copy-Paste",
  lookup_verification: "Search",
  judgment_text: "Manual Decision",
  wait_handoff: "Communication",
  approval_decision: "Approval",
  exception_branch: "Exception Handling",
};

const CAPABILITY_BY_SIGNATURE: Record<StepSignature, AICapability> = {
  entry: "RPA",
  repetitive: "RPA",
  copy_between_systems: "API Integration",
  lookup_verification: "Knowledge Retrieval",
  judgment_text: "LLM",
  wait_handoff: "Workflow Automation",
  approval_decision: "Workflow Automation",
  exception_branch: "Agentic AI",
};

const DEV_EFFORT_BY_LEVEL: Record<1 | 2 | 3, string> = {
  1: "1-3 days",
  2: "1-2 weeks",
  3: "3+ weeks",
};

export function categoryFor(signature: StepSignature): OpportunityCategory {
  return CATEGORY_BY_SIGNATURE[signature];
}

export function aiCapabilityFor(signature: StepSignature): AICapability {
  return CAPABILITY_BY_SIGNATURE[signature];
}

export function levelFor(rating: 1 | 2 | 3): Level {
  return rating === 1 ? "Low" : rating === 2 ? "Medium" : "High";
}

export function devEffortFor(effort: 1 | 2 | 3): string {
  return DEV_EFFORT_BY_LEVEL[effort];
}

// Impact/effort prioritization matrix: high impact + low effort wins first,
// high effort drags priority down even when impact is high.
export function priorityFor(impact: 1 | 2 | 3, effort: 1 | 2 | 3): Level {
  const score = impact - effort;
  if (score >= 1) return "High";
  if (score === 0) return "Medium";
  return "Low";
}

// How much to trust this as a genuine, recurring opportunity: mostly how
// consistently the step showed up across recorded sessions, nudged by any
// explicit thumbs feedback the user already gave that node.
export function confidenceScoreFor(occurrence: number, totalSessions: number, feedbackThumb?: Thumb): number {
  const frequencyPct = totalSessions > 0 ? (occurrence / totalSessions) * 100 : 0;
  const adjusted = feedbackThumb === "up" ? frequencyPct + 10 : feedbackThumb === "down" ? frequencyPct - 20 : frequencyPct;
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

export interface RegisterEntry {
  workflowId: string;
  stepId: string;
  name: string;
  workflowStep: string;
  description: string;
  category: OpportunityCategory;
  aiCapability: AICapability;
  complexity: Level;
  businessImpact: Level;
  estimatedDevEffort: string;
  estimatedHoursSavedPerMonth: number;
  estimatedAnnualCostSavings: number;
  confidenceScore: number;
  priority: Level;
  status: Opportunity["status"];
}

export function computeAIOpportunityRegister(
  registersByWorkflow: Record<string, Opportunity[]>,
  feedback: Record<string, Thumb>,
  hourlyCost: number
): RegisterEntry[] {
  const entries: RegisterEntry[] = [];
  for (const [workflowId, opportunities] of Object.entries(registersByWorkflow)) {
    for (const o of opportunities) {
      entries.push({
        workflowId,
        stepId: o.stepId,
        name: o.label,
        workflowStep: `${o.system}: ${o.label}`,
        description: o.suggestionText,
        category: categoryFor(o.signature),
        aiCapability: aiCapabilityFor(o.signature),
        complexity: levelFor(o.effort),
        businessImpact: levelFor(o.impact),
        estimatedDevEffort: devEffortFor(o.effort),
        estimatedHoursSavedPerMonth: o.estimatedSavingHrs,
        estimatedAnnualCostSavings: o.estimatedSavingHrs * hourlyCost * 12,
        confidenceScore: confidenceScoreFor(o.occurrence, o.totalSessions, feedback[o.stepId]),
        priority: priorityFor(o.impact, o.effort),
        status: o.status,
      });
    }
  }
  return entries.sort((a, b) => b.confidenceScore * 10 + priorityRank(b.priority) - (a.confidenceScore * 10 + priorityRank(a.priority)));
}

function priorityRank(level: Level): number {
  return level === "High" ? 2 : level === "Medium" ? 1 : 0;
}
