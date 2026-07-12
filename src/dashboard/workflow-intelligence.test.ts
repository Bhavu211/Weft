import { describe, expect, it } from "vitest";
import { computeWorkflowIntelligence } from "./workflow-intelligence";
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

// "Approve" -> approval_decision (effort 3, opportunity, not a bottleneck).
// "Copy Record" -> entry (no automation signal on its own; needs an input event
// for copy_between_systems, which this fixture doesn't include).
function workflowASession(id: string, endedAt = 2_000): Session {
  return {
    id,
    workflowId: "wf-a",
    startedAt: 0,
    endedAt,
    reviewed: true,
    events: [stepEvent(`${id}-1`, 0, "/a", "Approve"), stepEvent(`${id}-2`, 1_000, "/b", "Copy Record")],
  };
}

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

describe("computeWorkflowIntelligence", () => {
  it("returns one summary per distinct reviewed workflow", () => {
    const summaries = computeWorkflowIntelligence([
      workflowASession("s1"),
      workflowASession("s2"),
      workflowBSession("s3"),
    ]);
    expect(summaries.map((s) => s.workflowId).sort()).toEqual(["wf-a", "wf-b"]);
  });

  it("excludes unreviewed sessions entirely", () => {
    const unreviewed: Session = { ...workflowBSession("s3"), reviewed: false };
    const summaries = computeWorkflowIntelligence([workflowASession("s1"), workflowASession("s2"), unreviewed]);
    expect(summaries.some((s) => s.workflowId === "wf-b")).toBe(false);
  });

  it("counts sessions per workflow and sorts workflows by session count descending", () => {
    const summaries = computeWorkflowIntelligence([
      workflowASession("s1"),
      workflowASession("s2"),
      workflowBSession("s3"),
    ]);
    expect(summaries[0].workflowId).toBe("wf-a");
    expect(summaries[0].sessionCount).toBe(2);
    expect(summaries[1].sessionCount).toBe(1);
  });

  it("averages completion time (endedAt - startedAt) across a workflow's sessions", () => {
    const summaries = computeWorkflowIntelligence([workflowASession("s1", 2_000), workflowASession("s2", 4_000)]);
    const wfA = summaries.find((s) => s.workflowId === "wf-a")!;
    expect(wfA.avgCompletionTimeMs).toBe(3_000);
  });

  it("counts effort-3 steps as manual hotspots", () => {
    const summaries = computeWorkflowIntelligence([workflowASession("s1"), workflowASession("s2")]);
    const wfA = summaries.find((s) => s.workflowId === "wf-a")!;
    // "Approve" -> approval_decision, effort 3.
    expect(wfA.manualHotspotCount).toBe(1);
  });

  it("finds no bottlenecks or variants when every session in a workflow is identical", () => {
    const summaries = computeWorkflowIntelligence([workflowASession("s1"), workflowASession("s2")]);
    const wfA = summaries.find((s) => s.workflowId === "wf-a")!;
    expect(wfA.bottleneckCount).toBe(0);
    expect(wfA.variantCount).toBe(0);
  });

  it("returns an empty list when there are no reviewed sessions", () => {
    expect(computeWorkflowIntelligence([])).toEqual([]);
  });
});
