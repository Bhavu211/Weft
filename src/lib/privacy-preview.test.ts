import { describe, expect, it } from "vitest";
import { applyLabelEdits, buildPrivacyPreview } from "./privacy-preview";
import type { ClassifiedStep } from "../types";

function step(overrides: Partial<ClassifiedStep> = {}): ClassifiedStep {
  return {
    id: "s1",
    order: 0,
    ts: 0,
    durationMs: 5_000,
    domain: "erp.internal",
    urlPath: "/invoices",
    label: "Verify Invoice",
    events: [],
    isCrossSystem: false,
    signature: "lookup_verification",
    ...overrides,
  };
}

describe("buildPrivacyPreview", () => {
  it("exposes only label, system, order, and duration — never raw events", () => {
    const steps = [step()];
    const preview = buildPrivacyPreview(steps);

    expect(preview).toEqual([
      {
        id: "s1",
        order: 0,
        label: "Verify Invoice",
        system: "erp.internal/invoices",
        durationMs: 5_000,
      },
    ]);
    expect(preview[0]).not.toHaveProperty("events");
  });
});

describe("applyLabelEdits", () => {
  it("overrides only the labels named in the edit map", () => {
    const steps = [step({ id: "s1", label: "Verify Invoice" }), step({ id: "s2", label: "Approve Payment" })];

    const result = applyLabelEdits(steps, { s1: "[redacted]" });

    expect(result.map((s) => s.label)).toEqual(["[redacted]", "Approve Payment"]);
  });

  it("does not mutate the input steps", () => {
    const steps = [step({ id: "s1", label: "Verify Invoice" })];

    applyLabelEdits(steps, { s1: "[redacted]" });

    expect(steps[0].label).toBe("Verify Invoice");
  });

  it("leaves steps unchanged when no edit is given for them", () => {
    const steps = [step({ id: "s1", label: "Verify Invoice" })];

    const result = applyLabelEdits(steps, {});

    expect(result).toEqual(steps);
  });
});
