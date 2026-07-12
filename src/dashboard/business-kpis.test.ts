import { describe, expect, it } from "vitest";
import {
  computeAICapabilityDistribution,
  computeAutomationReadinessScore,
  computeBusinessKPIs,
  computeProcessHealthScore,
} from "./business-kpis";
import type { ExecutiveSummary } from "./executive-summary";
import type { WorkflowSummary } from "./workflow-intelligence";
import type { RegisterEntry } from "./ai-register";

function summary(overrides: Partial<ExecutiveSummary> = {}): ExecutiveSummary {
  return {
    totalWorkflows: 2,
    totalUsersObserved: 1,
    totalSessionsRecorded: 10,
    totalProcessVariants: 0,
    automationOpportunitiesDiscovered: 10,
    estimatedMonthlyHoursSaved: 20,
    estimatedAnnualSavings: 12_000,
    ...overrides,
  };
}

function registerEntry(overrides: Partial<RegisterEntry> = {}): RegisterEntry {
  return {
    workflowId: "wf-a",
    stepId: "s1",
    name: "Approve invoice",
    workflowStep: "erp.internal: Approve invoice",
    description: "...",
    category: "Approval",
    aiCapability: "Workflow Automation",
    complexity: "Medium",
    businessImpact: "High",
    estimatedDevEffort: "1-2 weeks",
    estimatedHoursSavedPerMonth: 4,
    estimatedAnnualCostSavings: 2_400,
    confidenceScore: 80,
    priority: "High",
    status: "identified",
    ...overrides,
  };
}

function workflowSummary(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    workflowId: "wf-a",
    sessionCount: 5,
    avgCompletionTimeMs: 60_000,
    variantCount: 0,
    bottleneckCount: 0,
    manualHotspotCount: 0,
    mergeResult: { nodes: [], edges: [], alignments: [], totalSessions: 5 },
    ...overrides,
  };
}

describe("computeAutomationReadinessScore", () => {
  it("is 0 with no discovered opportunities and no register entries", () => {
    expect(computeAutomationReadinessScore(0, [])).toBe(0);
  });

  it("scores higher when more discovered opportunities are registered", () => {
    const low = computeAutomationReadinessScore(10, [registerEntry({ status: "identified", confidenceScore: 50 })]);
    const high = computeAutomationReadinessScore(
      10,
      Array.from({ length: 8 }, (_, i) => registerEntry({ stepId: `s${i}`, status: "identified", confidenceScore: 50 }))
    );
    expect(high).toBeGreaterThan(low);
  });

  it("scores higher when registered opportunities are further along the pipeline", () => {
    const early = computeAutomationReadinessScore(10, [registerEntry({ status: "identified" })]);
    const late = computeAutomationReadinessScore(10, [registerEntry({ status: "sent_to_engineering" })]);
    expect(late).toBeGreaterThan(early);
  });

  it("caps coverage at 100% even if more entries are registered than discovered", () => {
    const entries = Array.from({ length: 20 }, (_, i) => registerEntry({ stepId: `s${i}` }));
    expect(computeAutomationReadinessScore(10, entries)).toBeLessThanOrEqual(100);
  });
});

describe("computeAICapabilityDistribution", () => {
  it("counts entries per AI capability, sorted descending", () => {
    const entries = [
      registerEntry({ stepId: "s1", aiCapability: "LLM" }),
      registerEntry({ stepId: "s2", aiCapability: "LLM" }),
      registerEntry({ stepId: "s3", aiCapability: "RPA" }),
    ];
    expect(computeAICapabilityDistribution(entries)).toEqual([
      { capability: "LLM", count: 2 },
      { capability: "RPA", count: 1 },
    ]);
  });

  it("returns an empty list with no entries", () => {
    expect(computeAICapabilityDistribution([])).toEqual([]);
  });
});

describe("computeProcessHealthScore", () => {
  it("is 100 when there are no workflows at all", () => {
    expect(computeProcessHealthScore([])).toBe(100);
  });

  it("is 100 when no workflow has any friction", () => {
    const workflows = [
      workflowSummary({ mergeResult: { nodes: [{}, {}, {}] as never, edges: [], alignments: [], totalSessions: 5 } }),
    ];
    expect(computeProcessHealthScore(workflows)).toBe(100);
  });

  it("drops as bottlenecks/hotspots/variants grow relative to total steps", () => {
    const workflows = [
      workflowSummary({
        bottleneckCount: 1,
        manualHotspotCount: 1,
        variantCount: 0,
        mergeResult: { nodes: [{}, {}, {}, {}] as never, edges: [], alignments: [], totalSessions: 5 },
      }),
    ];
    expect(computeProcessHealthScore(workflows)).toBe(50);
  });
});

describe("computeBusinessKPIs", () => {
  it("passes potential hours/savings straight through from the executive summary", () => {
    const kpis = computeBusinessKPIs(summary(), [], []);
    expect(kpis.potentialHoursSavedPerMonth).toBe(20);
    expect(kpis.potentialAnnualSavings).toBe(12_000);
  });

  it("forecasts ROI from non-shipped register entries only", () => {
    const entries = [
      registerEntry({ stepId: "s1", estimatedAnnualCostSavings: 1_000, status: "identified" }),
      registerEntry({ stepId: "s2", estimatedAnnualCostSavings: 500, status: "shipped" }),
    ];
    const kpis = computeBusinessKPIs(summary(), [], entries);
    expect(kpis.roiForecastAnnual).toBe(1_000);
  });
});
