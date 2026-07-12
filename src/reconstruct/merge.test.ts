import { describe, expect, it } from "vitest";
import { merge } from "./merge";
import type { CapturedEvent, Session } from "../types";

// Hand-merged ground truth for the M4 gate: three recordings of the same
// "process an invoice" workflow. Sessions A and B take the happy path;
// session C takes a different last step. The merge must:
//   - collapse the two shared steps (present in all 3 sessions) into one
//     main-path node each,
//   - split the diverging third step into two sibling nodes at the same
//     position: "Approve Payment" (2/3 sessions) as the main path, and
//     "Escalate to Manager" (1/3, a variant A and B never took) as a
//     flagged exception branch,
//   - and produce edges whose occurrence counts match how many sessions
//     actually took each transition.
function happyPathEvents(): CapturedEvent[] {
  return [
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
      element: { role: "button", label: "Verify Invoice", tag: "button" },
    },
    {
      id: "e3",
      ts: 2_000,
      type: "input",
      domain: "billing.internal",
      urlPath: "/payments/new",
      element: { role: "textbox", label: "Invoice Number", tag: "input" },
      crossDomainFrom: "erp.internal",
    },
    {
      id: "e4",
      ts: 3_000,
      type: "submit",
      domain: "billing.internal",
      urlPath: "/payments/new",
      element: { role: "form", label: "Payment Form", tag: "form" },
    },
  ];
}

function mainPathSession(id: string): Session {
  return {
    id,
    workflowId: "wf-invoice-approval",
    startedAt: 0,
    endedAt: 5_000,
    reviewed: true,
    events: [
      ...happyPathEvents(),
      {
        id: `${id}-e5`,
        ts: 4_000,
        type: "click",
        domain: "billing.internal",
        urlPath: "/payments/review",
        element: { role: "button", label: "Approve Payment", tag: "button" },
      },
    ],
  };
}

function exceptionSession(id: string): Session {
  return {
    id,
    workflowId: "wf-invoice-approval",
    startedAt: 0,
    endedAt: 5_000,
    reviewed: true,
    events: [
      ...happyPathEvents(),
      {
        id: `${id}-e5`,
        ts: 4_000,
        type: "click",
        domain: "billing.internal",
        urlPath: "/payments/escalate",
        element: { role: "button", label: "Escalate to Manager", tag: "button" },
      },
    ],
  };
}

describe("merge", () => {
  const sessionA = mainPathSession("sA");
  const sessionB = mainPathSession("sB");
  const sessionC = exceptionSession("sC");
  const result = merge([sessionA, sessionB, sessionC]);

  it("collapses steps shared by all sessions into one main-path node each", () => {
    const verify = result.nodes.find((n) => n.label === "Verify Invoice")!;
    const payment = result.nodes.find((n) => n.label === "Payment Form")!;

    expect(verify).toMatchObject({ occurrence: 3, totalSessions: 3, isMainPath: true, isException: false });
    expect(payment).toMatchObject({ occurrence: 3, totalSessions: 3, isMainPath: true, isException: false });
  });

  it("surfaces the variant a single session took as a flagged exception branch", () => {
    const approve = result.nodes.find((n) => n.label === "Approve Payment")!;
    const escalate = result.nodes.find((n) => n.label === "Escalate to Manager")!;

    expect(approve).toMatchObject({ occurrence: 2, totalSessions: 3, isMainPath: true, isException: false });
    expect(escalate).toMatchObject({
      occurrence: 1,
      totalSessions: 3,
      isMainPath: false,
      isException: true,
      signature: "exception_branch",
    });
    expect(result.nodes).toHaveLength(4);
  });

  it("emits edges whose occurrence reflects exactly which sessions took each transition", () => {
    const verify = result.nodes.find((n) => n.label === "Verify Invoice")!;
    const payment = result.nodes.find((n) => n.label === "Payment Form")!;
    const approve = result.nodes.find((n) => n.label === "Approve Payment")!;
    const escalate = result.nodes.find((n) => n.label === "Escalate to Manager")!;

    const edge = (from: string, to: string) => result.edges.find((e) => e.from === from && e.to === to);

    expect(edge(verify.id, payment.id)).toMatchObject({ occurrence: 3, totalSessions: 3 });
    expect(edge(payment.id, approve.id)).toMatchObject({ occurrence: 2, totalSessions: 3 });
    expect(edge(payment.id, escalate.id)).toMatchObject({ occurrence: 1, totalSessions: 3 });
    expect(result.edges).toHaveLength(3);
  });

  it("records which (session, step) pairs were merged into each node, for merge review", () => {
    const approve = result.nodes.find((n) => n.label === "Approve Payment")!;
    const alignment = result.alignments.find((a) => a.nodeId === approve.id)!;

    expect(alignment.contributors.map((c) => c.sessionId).sort()).toEqual(["sA", "sB"]);
  });
});
