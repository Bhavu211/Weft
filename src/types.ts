export type StepSignature =
  | "entry"
  | "repetitive"
  | "copy_between_systems"
  | "judgment_text"
  | "lookup_verification"
  | "wait_handoff"
  | "approval_decision"
  | "exception_branch";

export interface CapturedEvent {
  id: string;
  ts: number;
  type: "click" | "input" | "submit" | "navigation";
  domain: string;
  urlPath: string;
  element: { role: string; label: string; tag: string };
  crossDomainFrom?: string;
}

export interface Session {
  id: string;
  workflowId: string;
  startedAt: number;
  endedAt?: number;
  events: CapturedEvent[];
}

export interface MergedNode {
  id: string;
  order: number;
  label: string;
  system: string;
  signature: StepSignature;
  isCrossSystem: boolean;
  occurrence: number;
  totalSessions: number;
  isMainPath: boolean;
  avgDurationMs: number;
  intervention: string;
  effort: 1 | 2 | 3;
  impact: 1 | 2 | 3;
  isOpportunity: boolean;
  isBottleneck: boolean;
  isException: boolean;
  suggestionText: string;
  estimatedSavingHrsPerMonth: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  occurrence: number;
  totalSessions: number;
}

export interface AutomationBrief {
  problem: string;
  trigger: string;
  inputs: string;
  outputs: string;
  systems: string[];
  approach: string;
  effortEstimate: string;
  estimatedSavingHrs: number;
}

export interface Opportunity {
  stepId: string;
  label: string;
  intervention: string;
  impact: 1 | 2 | 3;
  brief: AutomationBrief;
  status: "identified" | "specced" | "shipped";
  estimatedSavingHrs: number;
  realizedSavingHrs?: number;
}

export interface ROI {
  shippedCount: number;
  hoursSaved: number;
  moneySaved: number;
  estimateVsActualPct: number;
}

export interface Workflow {
  id: string;
  name: string;
  sessions: Session[];
  mergedNodes: MergedNode[];
  edges: Edge[];
  register: Opportunity[];
  roi: ROI;
}
