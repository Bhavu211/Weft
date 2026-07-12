import { describe, expect, it } from "vitest";
import { estimateMonthlySavingHrs } from "./savings";

describe("estimateMonthlySavingHrs", () => {
  it("computes monthlyFrequency x hoursPerRun x automatableFraction", () => {
    const result = estimateMonthlySavingHrs({
      avgDurationMs: 3.6e6, // 1 hour
      automatableFraction: 0.5,
      occurrence: 3,
      totalSessions: 3,
      runsPerMonth: 20,
    });

    // 20 runs/month x 1hr x 0.5 = 10
    expect(result).toBeCloseTo(10, 5);
  });

  it("scales down for a step that only occurred in a minority of sessions", () => {
    const result = estimateMonthlySavingHrs({
      avgDurationMs: 3.6e6,
      automatableFraction: 0.5,
      occurrence: 1,
      totalSessions: 3,
      runsPerMonth: 20,
    });

    // occurrence/totalSessions = 1/3, so only a third of the 20 monthly runs count
    expect(result).toBeCloseTo((20 * (1 / 3)) * 1 * 0.5, 5);
  });

  it("returns 0 when automatableFraction is 0 (e.g. wait_handoff)", () => {
    const result = estimateMonthlySavingHrs({
      avgDurationMs: 3.6e6,
      automatableFraction: 0,
      occurrence: 3,
      totalSessions: 3,
    });

    expect(result).toBe(0);
  });

  it("returns 0 for an empty merge instead of dividing by zero", () => {
    const result = estimateMonthlySavingHrs({
      avgDurationMs: 3.6e6,
      automatableFraction: 0.8,
      occurrence: 0,
      totalSessions: 0,
    });

    expect(result).toBe(0);
  });
});
