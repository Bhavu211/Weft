import { PIPELINE_STAGES } from "../lib/pipeline";
import type { ExecutiveSummary } from "./executive-summary";
import type { WorkflowSummary } from "./workflow-intelligence";
import type { RegisterEntry } from "./ai-register";

export interface AICapabilityCount {
  capability: string;
  count: number;
}

export interface BusinessKPIs {
  // The ceiling: hours/dollars if every opportunity merge has ever
  // discovered got automated, whether or not it's been registered yet.
  potentialHoursSavedPerMonth: number;
  potentialAnnualSavings: number;
  // The realistic subset: annual value of what's actually in the pipeline
  // today (registered, not yet shipped) — distinct from the ceiling above,
  // and distinct from realized ROI (Dashboard 2 territory, out of scope).
  roiForecastAnnual: number;
  // 0-100 composite of how much of what's been discovered has entered the
  // pipeline, how far along those items are, and how confident we are in
  // them — see computeAutomationReadinessScore for the exact weights.
  automationReadinessScore: number;
  aiCapabilityDistribution: AICapabilityCount[];
  // 0-100: fewer bottlenecks/manual hotspots/variants relative to total
  // steps observed across all workflows reads as a healthier process.
  processHealthScore: number;
}

const MAX_STAGE_INDEX = PIPELINE_STAGES.length - 1;

function progressionFractionFor(entries: RegisterEntry[]): number {
  if (entries.length === 0) return 0;
  const total = entries.reduce((sum, e) => {
    const idx = PIPELINE_STAGES.indexOf(e.status as (typeof PIPELINE_STAGES)[number]);
    // Not found means "shipped" — further along than any pipeline stage.
    return sum + (idx === -1 ? 1 : idx / MAX_STAGE_INDEX);
  }, 0);
  return total / entries.length;
}

export function computeAutomationReadinessScore(
  totalDiscovered: number,
  entries: RegisterEntry[]
): number {
  const coverageFraction = totalDiscovered > 0 ? Math.min(1, entries.length / totalDiscovered) : 0;
  const progressionFraction = progressionFractionFor(entries);
  const avgConfidenceFraction =
    entries.length > 0 ? entries.reduce((sum, e) => sum + e.confidenceScore, 0) / entries.length / 100 : 0;

  return Math.round((coverageFraction * 0.4 + progressionFraction * 0.4 + avgConfidenceFraction * 0.2) * 100);
}

export function computeAICapabilityDistribution(entries: RegisterEntry[]): AICapabilityCount[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.aiCapability, (counts.get(e.aiCapability) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([capability, count]) => ({ capability, count }))
    .sort((a, b) => b.count - a.count);
}

export function computeProcessHealthScore(workflows: WorkflowSummary[]): number {
  const totalNodes = workflows.reduce((sum, w) => sum + w.mergeResult.nodes.length, 0);
  if (totalNodes === 0) return 100;
  const totalFriction = workflows.reduce(
    (sum, w) => sum + w.bottleneckCount + w.manualHotspotCount + w.variantCount,
    0
  );
  const frictionFraction = Math.min(1, totalFriction / totalNodes);
  return Math.round((1 - frictionFraction) * 100);
}

export function computeBusinessKPIs(
  summary: ExecutiveSummary,
  workflows: WorkflowSummary[],
  registerEntries: RegisterEntry[]
): BusinessKPIs {
  const roiForecastAnnual = registerEntries
    .filter((e) => e.status !== "shipped")
    .reduce((sum, e) => sum + e.estimatedAnnualCostSavings, 0);

  return {
    potentialHoursSavedPerMonth: summary.estimatedMonthlyHoursSaved,
    potentialAnnualSavings: summary.estimatedAnnualSavings,
    roiForecastAnnual,
    automationReadinessScore: computeAutomationReadinessScore(
      summary.automationOpportunitiesDiscovered,
      registerEntries
    ),
    aiCapabilityDistribution: computeAICapabilityDistribution(registerEntries),
    processHealthScore: computeProcessHealthScore(workflows),
  };
}
