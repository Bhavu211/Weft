import { describe, expect, it } from "vitest";
import { merge } from "./merge";
import type { CapturedEvent, Session } from "../types";

// Regression coverage for the alignment fix: a literal system+label+order
// key (the original MVP implementation) breaks the moment one session
// inserts or skips a step, because every later step in that session shifts
// to a different order index and stops matching everyone else's. These
// tests build sessions that do exactly that and check the shared
// downstream steps still collapse into one node instead of fragmenting.

function stepEvent(id: string, ts: number, urlPath: string, label: string): CapturedEvent {
  return {
    id,
    ts,
    type: "click",
    domain: "erp.internal",
    urlPath,
    element: { role: "button", label, tag: "button" },
  };
}

function happyPathSession(id: string): Session {
  return {
    id,
    workflowId: "wf-generic",
    startedAt: 0,
    endedAt: 4_000,
    reviewed: true,
    events: [
      stepEvent(`${id}-1`, 0, "/a", "Step A"),
      stepEvent(`${id}-2`, 1_000, "/b", "Step B"),
      stepEvent(`${id}-3`, 2_000, "/c", "Step C"),
      stepEvent(`${id}-4`, 3_000, "/d", "Step D"),
    ],
  };
}

function insertionSession(id: string): Session {
  return {
    id,
    workflowId: "wf-generic",
    startedAt: 0,
    endedAt: 5_000,
    reviewed: true,
    events: [
      stepEvent(`${id}-1`, 0, "/a", "Step A"),
      stepEvent(`${id}-2`, 1_000, "/b", "Step B"),
      stepEvent(`${id}-3`, 2_000, "/extra", "Extra Step"),
      stepEvent(`${id}-4`, 3_000, "/c", "Step C"),
      stepEvent(`${id}-5`, 4_000, "/d", "Step D"),
    ],
  };
}

function deletionSession(id: string): Session {
  return {
    id,
    workflowId: "wf-generic",
    startedAt: 0,
    endedAt: 3_000,
    reviewed: true,
    events: [
      stepEvent(`${id}-1`, 0, "/a", "Step A"),
      stepEvent(`${id}-2`, 1_000, "/c", "Step C"),
      stepEvent(`${id}-3`, 2_000, "/d", "Step D"),
    ],
  };
}

// A two-step swap: same number of steps as the happy path, just different
// ones at the last two positions — e.g. "Approve, Notify" vs "Escalate,
// Review". This is the equal-length compound-branch case: a literal
// single-step (len-1) special case would wrongly pass "Step C"/"Step D"
// through unchanged and bolt "Step X"/"Step Y" on sequentially afterward,
// implying they happen *after* D rather than *instead of* C and D.
function twoStepSwapSession(id: string): Session {
  return {
    id,
    workflowId: "wf-generic",
    startedAt: 0,
    endedAt: 4_000,
    reviewed: true,
    events: [
      stepEvent(`${id}-1`, 0, "/a", "Step A"),
      stepEvent(`${id}-2`, 1_000, "/b", "Step B"),
      stepEvent(`${id}-3`, 2_000, "/x", "Step X"),
      stepEvent(`${id}-4`, 3_000, "/y", "Step Y"),
    ],
  };
}

describe("merge — sessions with an inserted step", () => {
  const result = merge([happyPathSession("s1"), insertionSession("s2")]);

  it("still collapses the shared steps after the insertion into one node each, instead of fragmenting them", () => {
    const stepCNodes = result.nodes.filter((n) => n.label === "Step C");
    const stepDNodes = result.nodes.filter((n) => n.label === "Step D");

    expect(stepCNodes).toHaveLength(1);
    expect(stepCNodes[0]).toMatchObject({ occurrence: 2, totalSessions: 2, isMainPath: true, isException: false });

    expect(stepDNodes).toHaveLength(1);
    expect(stepDNodes[0]).toMatchObject({ occurrence: 2, totalSessions: 2, isMainPath: true, isException: false });
  });

  it("still recognizes the shared steps before the insertion", () => {
    const stepANodes = result.nodes.filter((n) => n.label === "Step A");
    const stepBNodes = result.nodes.filter((n) => n.label === "Step B");
    expect(stepANodes).toHaveLength(1);
    expect(stepANodes[0].occurrence).toBe(2);
    expect(stepBNodes).toHaveLength(1);
    expect(stepBNodes[0].occurrence).toBe(2);
  });

  it("surfaces the inserted step as its own node between B and C", () => {
    const extra = result.nodes.find((n) => n.label === "Extra Step")!;
    const stepB = result.nodes.find((n) => n.label === "Step B")!;
    const stepC = result.nodes.find((n) => n.label === "Step C")!;

    expect(extra.occurrence).toBe(1);
    expect(extra.order).toBeGreaterThan(stepB.order);
    expect(extra.order).toBeLessThan(stepC.order);
  });

  it("produces exactly 5 nodes total (no duplicates)", () => {
    expect(result.nodes).toHaveLength(5);
  });
});

describe("merge — sessions with a skipped (deleted) step", () => {
  const result = merge([happyPathSession("s1"), deletionSession("s2")]);

  it("still collapses the shared steps after the gap into one node each", () => {
    const stepCNodes = result.nodes.filter((n) => n.label === "Step C");
    const stepDNodes = result.nodes.filter((n) => n.label === "Step D");

    expect(stepCNodes).toHaveLength(1);
    expect(stepCNodes[0].occurrence).toBe(2);
    expect(stepDNodes).toHaveLength(1);
    expect(stepDNodes[0].occurrence).toBe(2);
  });

  it("keeps the skipped step as a single lower-occurrence node, not an exception (no sibling to diverge from)", () => {
    const stepB = result.nodes.find((n) => n.label === "Step B")!;
    expect(stepB.occurrence).toBe(1);
    expect(stepB.totalSessions).toBe(2);
    expect(stepB.isException).toBe(false);
    expect(stepB.isMainPath).toBe(true);
  });

  it("produces exactly 4 nodes total (no duplicates)", () => {
    expect(result.nodes).toHaveLength(4);
  });
});

describe("merge — sessions with an equal-length two-step swap", () => {
  const result = merge([happyPathSession("s1"), happyPathSession("s2"), twoStepSwapSession("s3")]);

  it("keeps Step C and Step D as the main path, not fragmented or displaced", () => {
    const stepC = result.nodes.filter((n) => n.label === "Step C");
    const stepD = result.nodes.filter((n) => n.label === "Step D");
    expect(stepC).toHaveLength(1);
    expect(stepD).toHaveLength(1);
    expect(stepC[0]).toMatchObject({ occurrence: 2, totalSessions: 3, isMainPath: true, isException: false });
    expect(stepD[0]).toMatchObject({ occurrence: 2, totalSessions: 3, isMainPath: true, isException: false });
  });

  it("surfaces Step X and Step Y as sibling branches at the SAME positions as C and D, not appended after D", () => {
    const stepC = result.nodes.find((n) => n.label === "Step C")!;
    const stepD = result.nodes.find((n) => n.label === "Step D")!;
    const stepX = result.nodes.find((n) => n.label === "Step X")!;
    const stepY = result.nodes.find((n) => n.label === "Step Y")!;

    expect(stepX.order).toBe(stepC.order);
    expect(stepY.order).toBe(stepD.order);
    expect(stepX).toMatchObject({ occurrence: 1, totalSessions: 3, isMainPath: false, isException: true });
    expect(stepY).toMatchObject({ occurrence: 1, totalSessions: 3, isMainPath: false, isException: true });
  });

  it("produces exactly 6 nodes total (A, B, C/X pair, D/Y pair)", () => {
    expect(result.nodes).toHaveLength(6);
  });

  it("emits an edge from Step B straight into Step X (the branch), not from Step D", () => {
    const stepB = result.nodes.find((n) => n.label === "Step B")!;
    const stepX = result.nodes.find((n) => n.label === "Step X")!;
    const edge = result.edges.find((e) => e.from === stepB.id && e.to === stepX.id);
    expect(edge).toMatchObject({ occurrence: 1, totalSessions: 3 });
  });
});
