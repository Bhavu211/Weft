import { describe, expect, it } from "vitest";
import { segment } from "./segment";
import type { CapturedEvent, Session } from "../types";

function event(overrides: Partial<CapturedEvent> & Pick<CapturedEvent, "id" | "ts" | "type">): CapturedEvent {
  return {
    domain: "systema.com",
    urlPath: "/",
    element: { role: "generic", label: "", tag: "div" },
    ...overrides,
  };
}

describe("segment", () => {
  it("groups consecutive events on the same domain/path into one step", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 3000,
      events: [
        event({ id: "e1", ts: 0, type: "navigation", element: { role: "document", label: "", tag: "document" } }),
        event({ id: "e2", ts: 1000, type: "input", element: { role: "textbox", label: "Invoice Number", tag: "input" } }),
        event({ id: "e3", ts: 2000, type: "click", element: { role: "button", label: "Search", tag: "button" } }),
      ],
    };

    const steps = segment(session);

    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe("e1");
    expect(steps[0].events.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(steps[0].label).toBe("Search"); // last labeled event wins
    expect(steps[0].durationMs).toBe(3000); // to session end, no next step
  });

  it("starts a new step on path change", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 2000,
      events: [
        event({ id: "e1", ts: 0, type: "navigation", urlPath: "/search" }),
        event({ id: "e2", ts: 500, type: "navigation", urlPath: "/results" }),
      ],
    };

    const steps = segment(session);

    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.id)).toEqual(["e1", "e2"]);
  });

  it("starts a new step on domain change", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 2000,
      events: [
        event({ id: "e1", ts: 0, type: "navigation", domain: "erp.internal" }),
        event({ id: "e2", ts: 500, type: "navigation", domain: "billing.internal", crossDomainFrom: "erp.internal" }),
      ],
    };

    const steps = segment(session);

    expect(steps).toHaveLength(2);
    expect(steps[1].isCrossSystem).toBe(true);
  });

  it("starts a new step right after a form submit, even on the same path", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 3000,
      events: [
        event({ id: "e1", ts: 0, type: "input", element: { role: "textbox", label: "Amount", tag: "input" } }),
        event({ id: "e2", ts: 500, type: "submit", element: { role: "form", label: "Payment Form", tag: "form" } }),
        event({ id: "e3", ts: 1000, type: "click", element: { role: "button", label: "Close Dialog", tag: "button" } }),
      ],
    };

    const steps = segment(session);

    expect(steps).toHaveLength(2);
    expect(steps[0].events.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(steps[1].events.map((e) => e.id)).toEqual(["e3"]);
  });

  it("starts a new step after an idle gap greater than 8 seconds", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 20_000,
      events: [
        event({ id: "e1", ts: 0, type: "click" }),
        event({ id: "e2", ts: 8_001, type: "click" }), // > 8s gap: new step
      ],
    };

    const steps = segment(session);

    expect(steps).toHaveLength(2);
  });

  it("does not start a new step for a gap of exactly 8 seconds", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 10_000,
      events: [event({ id: "e1", ts: 0, type: "click" }), event({ id: "e2", ts: 8_000, type: "click" })],
    };

    const steps = segment(session);

    expect(steps).toHaveLength(1);
  });

  it("uses the session end time for the last step's duration", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 9000,
      events: [event({ id: "e1", ts: 4000, type: "click", element: { role: "button", label: "Submit", tag: "button" } })],
    };

    const steps = segment(session);

    expect(steps[0].durationMs).toBe(5000);
  });

  it("falls back to the last event's own timestamp when the session has no end time", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      events: [event({ id: "e1", ts: 4000, type: "click" })],
    };

    const steps = segment(session);

    expect(steps[0].durationMs).toBe(0);
  });

  it("splits a multi-screen wizard into one step per distinct path, even with many events per screen", () => {
    // Regression case: a 6-screen onboarding flow, each screen contributing a
    // burst of field-level events well under the 8s idle gap. Some screens
    // (e.g. an auto-advancing verification-result screen) carry only a
    // single event — segmentation must still split on path alone.
    const paths = [
      "/onboarding/applicant",
      "/onboarding/tax-ids",
      "/kyc/verify",
      "/kyc/result",
      "/onboarding/approve",
      "/sheet/partners",
    ];

    const events: CapturedEvent[] = [];
    let ts = 0;
    let idCounter = 0;
    for (const urlPath of paths) {
      const domain = urlPath.startsWith("/kyc") ? "kyc.internal" : "app.internal";
      const eventsOnThisScreen = urlPath === "/kyc/result" ? 1 : 5;
      for (let i = 0; i < eventsOnThisScreen; i++) {
        events.push(
          event({
            id: `e${idCounter++}`,
            ts,
            type: "input",
            domain,
            urlPath,
            element: { role: "textbox", label: `Field ${i}`, tag: "input" },
          })
        );
        ts += 200; // well under the 8s idle threshold
      }
    }

    const session: Session = { id: "s1", workflowId: "w1", startedAt: 0, endedAt: ts, events };
    const steps = segment(session);

    expect(steps).toHaveLength(paths.length);
    expect(steps.map((s) => s.urlPath)).toEqual(paths);
  });

  it("falls back to the role when no event in the group has a label", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 1000,
      events: [event({ id: "e1", ts: 0, type: "navigation", element: { role: "document", label: "", tag: "document" } })],
    };

    const steps = segment(session);

    expect(steps[0].label).toBe("document");
  });

  it("does not throw when a session has no events", () => {
    const session: Session = { id: "s1", workflowId: "w1", startedAt: 0, endedAt: 0, events: [] };
    expect(() => segment(session)).not.toThrow();
    expect(segment(session)).toEqual([]);
  });

  it("does not throw when an event is missing its element", () => {
    const session: Session = {
      id: "s1",
      workflowId: "w1",
      startedAt: 0,
      endedAt: 1000,
      events: [{ ...event({ id: "e1", ts: 0, type: "click" }), element: undefined as unknown as CapturedEvent["element"] }],
    };

    expect(() => segment(session)).not.toThrow();
    expect(segment(session)[0].label).toBe("");
  });
});
