import { describe, expect, it } from "vitest";
import { segment } from "./segment";
import { classify } from "./classify";
import type { CapturedEvent, Session } from "../types";

// A hand-authored "process an invoice" session spanning two systems, used as
// ground truth for the M2 gate: segment + classify must reproduce this exact
// step list, in order, from the raw event stream below.
//
// Expected grouping under the path/submit/domain/idle-gap>8s rule:
//   step 0: e1..e6 (same domain+path throughout, all gaps <= 8s)
//   step 1: e7, e8 (new step on domain change at e7; e8 stays since same domain/path, no submit before it, gap < 8s)
//   step 2: e9    (new step because e8 was a submit, and the path also changed)
const events: CapturedEvent[] = [
  {
    id: "e1",
    ts: 0,
    type: "navigation",
    domain: "erp.internal",
    urlPath: "/invoices",
    element: { role: "document", label: "", tag: "document" },
  },
  {
    id: "e2",
    ts: 1_000,
    type: "click",
    domain: "erp.internal",
    urlPath: "/invoices",
    element: { role: "button", label: "Search Invoice", tag: "button" },
  },
  {
    id: "e3",
    ts: 2_000,
    type: "input",
    domain: "erp.internal",
    urlPath: "/invoices",
    element: { role: "textbox", label: "Invoice Number", tag: "input" },
  },
  {
    id: "e4",
    ts: 2_100,
    type: "input",
    domain: "erp.internal",
    urlPath: "/invoices",
    element: { role: "textbox", label: "Invoice Number", tag: "input" },
  },
  {
    id: "e5",
    ts: 2_200,
    type: "input",
    domain: "erp.internal",
    urlPath: "/invoices",
    element: { role: "textbox", label: "Invoice Number", tag: "input" },
  },
  {
    id: "e6",
    ts: 3_000,
    type: "click",
    domain: "erp.internal",
    urlPath: "/invoices",
    element: { role: "button", label: "Verify Invoice", tag: "button" },
  },
  // domain change: carries the looked-up invoice number to a second system
  {
    id: "e7",
    ts: 4_000,
    type: "input",
    domain: "billing.internal",
    urlPath: "/payments/new",
    element: { role: "textbox", label: "Invoice Number", tag: "input" },
    crossDomainFrom: "erp.internal",
  },
  {
    id: "e8",
    ts: 6_000,
    type: "submit",
    domain: "billing.internal",
    urlPath: "/payments/new",
    element: { role: "form", label: "Payment Form", tag: "form" },
  },
  // 10-minute gap + path change: submitted payment now waits on someone else's approval
  {
    id: "e9",
    ts: 606_000,
    type: "click",
    domain: "billing.internal",
    urlPath: "/payments/review",
    element: { role: "button", label: "Approve Payment", tag: "button" },
  },
];

const session: Session = {
  id: "s1",
  workflowId: "w1",
  startedAt: 0,
  endedAt: 607_000,
  events,
};

describe("segment + classify pipeline", () => {
  it("groups events into the expected steps", () => {
    const steps = segment(session);
    expect(steps.map((s) => s.events.map((e) => e.id))).toEqual([
      ["e1", "e2", "e3", "e4", "e5", "e6"],
      ["e7", "e8"],
      ["e9"],
    ]);
  });

  it("reproduces the hand-made ground-truth step list, in order", () => {
    const result = classify(segment(session));

    expect(result.map(({ id, order, label, durationMs, signature }) => ({ id, order, label, durationMs, signature }))).toEqual([
      { id: "e1", order: 0, label: "Verify Invoice", durationMs: 4_000, signature: "lookup_verification" },
      { id: "e7", order: 1, label: "Payment Form", durationMs: 602_000, signature: "wait_handoff" },
      { id: "e9", order: 2, label: "Approve Payment", durationMs: 1_000, signature: "approval_decision" },
    ]);
  });
});
