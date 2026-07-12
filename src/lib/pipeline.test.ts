import { describe, expect, it } from "vitest";
import { advanceOpportunity, computeAutomationPipeline, nextStage, stageLabel, statusAfterBriefGenerated } from "./pipeline";
import type { Opportunity } from "../types";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    stepId: "step-1",
    label: "Approve invoice",
    system: "erp.internal",
    signature: "approval_decision",
    isCrossSystem: false,
    intervention: "Policy automation + routing",
    suggestionText: "...",
    effort: 2,
    impact: 3,
    occurrence: 5,
    totalSessions: 10,
    avgDurationMs: 30_000,
    status: "identified",
    estimatedSavingHrs: 4,
    ...overrides,
  };
}

describe("nextStage", () => {
  it("walks identified -> reviewed -> approved -> specced -> sent_to_engineering", () => {
    expect(nextStage("identified")).toBe("reviewed");
    expect(nextStage("reviewed")).toBe("approved");
    expect(nextStage("approved")).toBe("specced");
    expect(nextStage("specced")).toBe("sent_to_engineering");
  });

  it("returns null once at the last pre-handoff stage", () => {
    expect(nextStage("sent_to_engineering")).toBeNull();
  });

  it("returns null for shipped — that's outside this pipeline", () => {
    expect(nextStage("shipped")).toBeNull();
  });
});

describe("advanceOpportunity", () => {
  it("moves the opportunity to the next stage", () => {
    const o = opportunity({ status: "identified" });
    expect(advanceOpportunity(o).status).toBe("reviewed");
  });

  it("is a no-op once at sent_to_engineering", () => {
    const o = opportunity({ status: "sent_to_engineering" });
    expect(advanceOpportunity(o).status).toBe("sent_to_engineering");
  });

  it("does not mutate the original opportunity", () => {
    const o = opportunity({ status: "identified" });
    advanceOpportunity(o);
    expect(o.status).toBe("identified");
  });
});

describe("stageLabel", () => {
  it("gives a human label for each stage", () => {
    expect(stageLabel("identified")).toBe("New");
    expect(stageLabel("sent_to_engineering")).toBe("Sent to Engineering");
  });
});

describe("statusAfterBriefGenerated", () => {
  it("bumps any pre-spec stage up to specced", () => {
    expect(statusAfterBriefGenerated("identified")).toBe("specced");
    expect(statusAfterBriefGenerated("reviewed")).toBe("specced");
    expect(statusAfterBriefGenerated("approved")).toBe("specced");
  });

  it("leaves specced and later stages untouched", () => {
    expect(statusAfterBriefGenerated("specced")).toBe("specced");
    expect(statusAfterBriefGenerated("sent_to_engineering")).toBe("sent_to_engineering");
    expect(statusAfterBriefGenerated("shipped")).toBe("shipped");
  });
});

describe("computeAutomationPipeline", () => {
  it("buckets opportunities into columns by stage, across all workflows", () => {
    const registers = {
      "wf-a": [opportunity({ stepId: "a1", status: "identified" }), opportunity({ stepId: "a2", status: "approved" })],
      "wf-b": [opportunity({ stepId: "b1", status: "specced" })],
    };
    const columns = computeAutomationPipeline(registers);
    expect(columns.map((c) => c.stage)).toEqual(["identified", "reviewed", "approved", "specced", "sent_to_engineering"]);
    expect(columns.find((c) => c.stage === "identified")?.opportunities).toHaveLength(1);
    expect(columns.find((c) => c.stage === "approved")?.opportunities).toHaveLength(1);
    expect(columns.find((c) => c.stage === "specced")?.opportunities).toHaveLength(1);
    expect(columns.find((c) => c.stage === "reviewed")?.opportunities).toHaveLength(0);
  });

  it("excludes shipped opportunities entirely — that's Dashboard 2 territory", () => {
    const registers = { "wf-a": [opportunity({ status: "shipped" })] };
    const columns = computeAutomationPipeline(registers);
    const total = columns.reduce((sum, c) => sum + c.opportunities.length, 0);
    expect(total).toBe(0);
  });

  it("returns all five columns, empty, when there are no registers", () => {
    const columns = computeAutomationPipeline({});
    expect(columns).toHaveLength(5);
    expect(columns.every((c) => c.opportunities.length === 0)).toBe(true);
  });
});
