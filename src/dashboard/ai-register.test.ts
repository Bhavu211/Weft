import { describe, expect, it } from "vitest";
import {
  aiCapabilityFor,
  categoryFor,
  computeAIOpportunityRegister,
  confidenceScoreFor,
  devEffortFor,
  levelFor,
  priorityFor,
} from "./ai-register";
import type { Opportunity } from "../types";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    stepId: "step-1",
    label: "Approve invoice",
    system: "erp.internal",
    signature: "approval_decision",
    isCrossSystem: false,
    intervention: "Policy automation + routing",
    suggestionText: "This is a rule-bound approval...",
    effort: 2,
    impact: 3,
    occurrence: 8,
    totalSessions: 10,
    avgDurationMs: 30_000,
    status: "identified",
    estimatedSavingHrs: 4,
    ...overrides,
  };
}

describe("categoryFor / aiCapabilityFor", () => {
  it("maps every step signature to a category and an AI capability", () => {
    const signatures = [
      "entry",
      "repetitive",
      "copy_between_systems",
      "lookup_verification",
      "judgment_text",
      "wait_handoff",
      "approval_decision",
      "exception_branch",
    ] as const;
    for (const sig of signatures) {
      expect(categoryFor(sig)).toBeTruthy();
      expect(aiCapabilityFor(sig)).toBeTruthy();
    }
  });

  it("maps judgment_text to LLM and copy_between_systems to API Integration", () => {
    expect(aiCapabilityFor("judgment_text")).toBe("LLM");
    expect(aiCapabilityFor("copy_between_systems")).toBe("API Integration");
  });
});

describe("levelFor / devEffortFor", () => {
  it("maps 1/2/3 to Low/Medium/High", () => {
    expect(levelFor(1)).toBe("Low");
    expect(levelFor(2)).toBe("Medium");
    expect(levelFor(3)).toBe("High");
  });

  it("gives a longer dev-effort estimate for higher effort", () => {
    expect(devEffortFor(1)).toBe("1-3 days");
    expect(devEffortFor(3)).toBe("3+ weeks");
  });
});

describe("priorityFor", () => {
  it("ranks high impact + low effort as High priority", () => {
    expect(priorityFor(3, 1)).toBe("High");
  });

  it("ranks high impact + high effort as only Medium priority", () => {
    expect(priorityFor(3, 3)).toBe("Medium");
  });

  it("ranks low impact + high effort as Low priority", () => {
    expect(priorityFor(1, 3)).toBe("Low");
  });
});

describe("confidenceScoreFor", () => {
  it("is the raw frequency percentage with no feedback", () => {
    expect(confidenceScoreFor(8, 10)).toBe(80);
  });

  it("boosts confidence on thumbs up, capped at 100", () => {
    expect(confidenceScoreFor(10, 10, "up")).toBe(100);
  });

  it("cuts confidence on thumbs down, floored at 0", () => {
    expect(confidenceScoreFor(1, 10, "down")).toBe(0);
  });
});

describe("computeAIOpportunityRegister", () => {
  it("produces one entry per opportunity across all workflows", () => {
    const registers = {
      "wf-a": [opportunity({ stepId: "a1" }), opportunity({ stepId: "a2" })],
      "wf-b": [opportunity({ stepId: "b1" })],
    };
    const entries = computeAIOpportunityRegister(registers, {}, 50);
    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.workflowId === "wf-a" || e.workflowId === "wf-b")).toBe(true);
  });

  it("computes estimated annual cost savings as monthly hours saved x hourly cost x 12", () => {
    const registers = { "wf-a": [opportunity({ estimatedSavingHrs: 5 })] };
    const entries = computeAIOpportunityRegister(registers, {}, 50);
    expect(entries[0].estimatedAnnualCostSavings).toBe(5 * 50 * 12);
  });

  it("carries the opportunity's existing status through untouched", () => {
    const registers = { "wf-a": [opportunity({ status: "specced" })] };
    const entries = computeAIOpportunityRegister(registers, {}, 50);
    expect(entries[0].status).toBe("specced");
  });

  it("looks up feedback by stepId when scoring confidence", () => {
    const registers = { "wf-a": [opportunity({ stepId: "s1", occurrence: 5, totalSessions: 10 })] };
    const entries = computeAIOpportunityRegister(registers, { s1: "up" }, 50);
    expect(entries[0].confidenceScore).toBe(60);
  });

  it("returns an empty list when there are no registers at all", () => {
    expect(computeAIOpportunityRegister({}, {}, 50)).toEqual([]);
  });
});
