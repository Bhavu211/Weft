import { describe, expect, it } from "vitest";
import { computeExecutiveSummary } from "./executive-summary";
import type { CapturedEvent, Session } from "../types";

function stepEvent(id: string, ts: number, urlPath: string, label: string, domain = "erp.internal"): CapturedEvent {
  return {
    id,
    ts,
    type: "click",
    domain,
    urlPath,
    element: { role: "button", label, tag: "button" },
  };
}

// Workflow A: two identical happy-path sessions, no variants.
function workflowASession(id: string): Session {
  return {
    id,
    workflowId: "wf-a",
    startedAt: 0,
    endedAt: 2_000,
    reviewed: true,
    events: [stepEvent(`${id}-1`, 0, "/a", "Approve"), stepEvent(`${id}-2`, 1_000, "/b", "Copy Record")],
  };
}

// Workflow B: a single session (no variants possible with just one).
function workflowBSession(id: string): Session {
  return {
    id,
    workflowId: "wf-b",
    startedAt: 0,
    endedAt: 1_000,
    reviewed: true,
    events: [stepEvent(`${id}-1`, 0, "/x", "Verify Invoice")],
  };
}

describe("computeExecutiveSummary", () => {
  it("counts distinct workflows from reviewed sessions only", () => {
    const unreviewed: Session = { ...workflowBSession("s3"), reviewed: false, id: "s3" };
    const summary = computeExecutiveSummary(
      [workflowASession("s1"), workflowASession("s2"), unreviewed],
      50
    );
    // wf-a has 2 reviewed sessions; wf-b's only session is unreviewed, so it doesn't count as an analyzed workflow.
    expect(summary.totalWorkflows).toBe(1);
  });

  it("counts every session in storage toward sessions recorded, reviewed or not", () => {
    const unreviewed: Session = { ...workflowBSession("s3"), reviewed: false, id: "s3" };
    const summary = computeExecutiveSummary([workflowASession("s1"), unreviewed], 50);
    expect(summary.totalSessionsRecorded).toBe(2);
  });

  it("always reports totalUsersObserved as 1 — Weft never tracks individual identity", () => {
    const summary = computeExecutiveSummary([workflowASession("s1"), workflowBSession("s2")], 50);
    expect(summary.totalUsersObserved).toBe(1);
  });

  it("finds no variants when every session in a workflow is identical", () => {
    const summary = computeExecutiveSummary([workflowASession("s1"), workflowASession("s2")], 50);
    expect(summary.totalProcessVariants).toBe(0);
  });

  it("counts opportunity nodes and sums their estimated savings across all workflows", () => {
    const summary = computeExecutiveSummary(
      [workflowASession("s1"), workflowASession("s2"), workflowBSession("s3")],
      50
    );
    // "Approve" -> approval_decision (opportunity), "Copy Record" -> entry (not an opportunity, no input events),
    // "Verify Invoice" -> lookup_verification (opportunity). So 2 opportunity nodes total across both workflows.
    expect(summary.automationOpportunitiesDiscovered).toBe(2);
    expect(summary.estimatedMonthlyHoursSaved).toBeGreaterThanOrEqual(0);
  });

  it("computes annual savings as monthly hours x hourly cost x 12", () => {
    const summary = computeExecutiveSummary([workflowBSession("s1")], 100);
    expect(summary.estimatedAnnualSavings).toBeCloseTo(summary.estimatedMonthlyHoursSaved * 100 * 12, 5);
  });

  it("returns all zeros for no sessions at all", () => {
    const summary = computeExecutiveSummary([], 50);
    expect(summary).toEqual({
      totalWorkflows: 0,
      totalUsersObserved: 1,
      totalSessionsRecorded: 0,
      totalProcessVariants: 0,
      automationOpportunitiesDiscovered: 0,
      estimatedMonthlyHoursSaved: 0,
      estimatedAnnualSavings: 0,
    });
  });
});
