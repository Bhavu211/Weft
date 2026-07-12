import { describe, expect, it } from "vitest";
import { computeRoi } from "./roi";
import type { Opportunity } from "../types";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    stepId: "node-1-0",
    label: "Approve",
    system: "billing.internal",
    signature: "approval_decision",
    isCrossSystem: false,
    intervention: "Policy automation + routing",
    suggestionText: "",
    effort: 3,
    impact: 2,
    occurrence: 2,
    totalSessions: 2,
    avgDurationMs: 1000,
    status: "identified",
    estimatedSavingHrs: 10,
    ...overrides,
  };
}

describe("computeRoi", () => {
  it("returns all zeros when nothing has shipped", () => {
    const roi = computeRoi([opportunity({ status: "identified" }), opportunity({ status: "specced" })]);
    expect(roi).toEqual({ shippedCount: 0, hoursSaved: 0, moneySaved: 0, estimateVsActualPct: 0 });
  });

  it("counts only shipped opportunities", () => {
    const roi = computeRoi([
      opportunity({ stepId: "a", status: "shipped", estimatedSavingHrs: 10, realizedSavingHrs: 8 }),
      opportunity({ stepId: "b", status: "specced" }),
    ]);
    expect(roi.shippedCount).toBe(1);
  });

  it("sums realized hours across shipped items and prices them at the hourly cost", () => {
    const roi = computeRoi(
      [
        opportunity({ stepId: "a", status: "shipped", estimatedSavingHrs: 10, realizedSavingHrs: 8 }),
        opportunity({ stepId: "b", status: "shipped", estimatedSavingHrs: 5, realizedSavingHrs: 4 }),
      ],
      100
    );
    expect(roi.hoursSaved).toBe(12);
    expect(roi.moneySaved).toBe(1200);
  });

  it("computes estimate-vs-actual as realized/estimated x 100", () => {
    const roi = computeRoi([opportunity({ status: "shipped", estimatedSavingHrs: 10, realizedSavingHrs: 5 })]);
    expect(roi.estimateVsActualPct).toBeCloseTo(50, 5);
  });

  it("treats a missing realizedSavingHrs as 0 rather than throwing", () => {
    const roi = computeRoi([opportunity({ status: "shipped", estimatedSavingHrs: 10, realizedSavingHrs: undefined })]);
    expect(roi.hoursSaved).toBe(0);
    expect(roi.estimateVsActualPct).toBe(0);
  });

  it("uses DEFAULT_HOURLY_COST when no hourly cost is passed", () => {
    const roi = computeRoi([opportunity({ status: "shipped", realizedSavingHrs: 2 })]);
    expect(roi.moneySaved).toBe(2 * 50);
  });
});
