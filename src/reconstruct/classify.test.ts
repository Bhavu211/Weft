import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import type { CapturedEvent, Step } from "../types";

function ev(overrides: Partial<CapturedEvent> & Pick<CapturedEvent, "id" | "type">): CapturedEvent {
  return {
    ts: 0,
    domain: "systema.com",
    urlPath: "/",
    element: { role: "generic", label: "", tag: "div" },
    ...overrides,
  };
}

function step(overrides: Partial<Step> & Pick<Step, "id" | "events" | "label">): Step {
  return {
    order: 0,
    ts: 0,
    durationMs: 1000,
    domain: "systema.com",
    urlPath: "/",
    isCrossSystem: false,
    ...overrides,
  };
}

describe("classify", () => {
  it("classifies a plain input step as entry", () => {
    const [result] = classify([
      step({
        id: "e1",
        label: "First Name",
        events: [ev({ id: "e1", type: "input", element: { role: "textbox", label: "First Name", tag: "input" } })],
      }),
    ]);
    expect(result.signature).toBe("entry");
  });

  it("classifies a long-idle step as wait_handoff", () => {
    const [result] = classify([
      step({ id: "e1", label: "Submit", durationMs: 6 * 60 * 1000, events: [ev({ id: "e1", type: "submit" })] }),
    ]);
    expect(result.signature).toBe("wait_handoff");
  });

  it("classifies a cross-system step with input as copy_between_systems", () => {
    const [result] = classify([
      step({
        id: "e1",
        label: "Invoice Number",
        isCrossSystem: true,
        events: [ev({ id: "e1", type: "input", element: { role: "textbox", label: "Invoice Number", tag: "input" } })],
      }),
    ]);
    expect(result.signature).toBe("copy_between_systems");
  });

  it("classifies an approve/reject step as approval_decision", () => {
    const [result] = classify([
      step({
        id: "e1",
        label: "Approve",
        events: [ev({ id: "e1", type: "click", element: { role: "button", label: "Approve", tag: "button" } })],
      }),
    ]);
    expect(result.signature).toBe("approval_decision");
  });

  it("classifies a cancel/error step as exception_branch", () => {
    const [result] = classify([
      step({
        id: "e1",
        label: "Cancel Order",
        events: [ev({ id: "e1", type: "click", element: { role: "button", label: "Cancel Order", tag: "button" } })],
      }),
    ]);
    expect(result.signature).toBe("exception_branch");
  });

  it("classifies a search/verify step as lookup_verification", () => {
    const [result] = classify([
      step({
        id: "e1",
        label: "Verify Address",
        events: [ev({ id: "e1", type: "click", element: { role: "button", label: "Verify Address", tag: "button" } })],
      }),
    ]);
    expect(result.signature).toBe("lookup_verification");
  });

  it("classifies a step containing textarea input as judgment_text", () => {
    const [result] = classify([
      step({
        id: "e1",
        label: "Notes",
        events: [ev({ id: "e1", type: "input", element: { role: "textbox", label: "Notes", tag: "textarea" } })],
      }),
    ]);
    expect(result.signature).toBe("judgment_text");
  });

  it("promotes a step recurring 3+ times from entry to repetitive", () => {
    const steps = ["e1", "e2", "e3"].map((id) =>
      step({
        id,
        label: "Add Row",
        events: [ev({ id, type: "click", element: { role: "button", label: "Add Row", tag: "button" } })],
      })
    );
    const results = classify(steps);
    expect(results.map((r) => r.signature)).toEqual(["repetitive", "repetitive", "repetitive"]);
  });

  it("does not promote a step recurring only twice", () => {
    const steps = ["e1", "e2"].map((id) =>
      step({
        id,
        label: "Add Row",
        events: [ev({ id, type: "click", element: { role: "button", label: "Add Row", tag: "button" } })],
      })
    );
    const results = classify(steps);
    expect(results.map((r) => r.signature)).toEqual(["entry", "entry"]);
  });

  it("does not override a more specific signature with repetitive", () => {
    const steps = ["e1", "e2", "e3"].map((id) =>
      step({
        id,
        label: "Approve",
        events: [ev({ id, type: "click", element: { role: "button", label: "Approve", tag: "button" } })],
      })
    );
    const results = classify(steps);
    expect(results.map((r) => r.signature)).toEqual([
      "approval_decision",
      "approval_decision",
      "approval_decision",
    ]);
  });

  it("does not throw when a step's events array is missing", () => {
    const malformed = step({ id: "e1", label: "Mystery", events: undefined as unknown as Step["events"] });
    expect(() => classify([malformed])).not.toThrow();
  });

  it("does not throw when a step's label is missing", () => {
    const malformed = step({
      id: "e1",
      label: undefined as unknown as string,
      events: [ev({ id: "e1", type: "click" })],
    });
    expect(() => classify([malformed])).not.toThrow();
  });

  it("does not throw when an event in the group is missing its element", () => {
    const malformed = step({
      id: "e1",
      label: "Notes",
      events: [{ ...ev({ id: "e1", type: "input" }), element: undefined as unknown as CapturedEvent["element"] }],
    });
    expect(() => classify([malformed])).not.toThrow();
  });
});
