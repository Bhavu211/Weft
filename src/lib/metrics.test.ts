import { describe, expect, it } from "vitest";
import { computeMetricRates, type MetricCounters } from "./metrics";
import type { Thumb } from "../types";

function counters(overrides: Partial<MetricCounters> = {}): MetricCounters {
  return {
    reachedFirstMergedMap: false,
    opportunitiesAnalyzed: 0,
    opportunitiesAccepted: 0,
    opportunitiesShipped: 0,
    ...overrides,
  };
}

const noFeedback: Record<string, Thumb> = {};

describe("computeMetricRates", () => {
  it("reports activation directly from the flag", () => {
    expect(computeMetricRates(counters({ reachedFirstMergedMap: true }), noFeedback).activationReached).toBe(true);
    expect(computeMetricRates(counters({ reachedFirstMergedMap: false }), noFeedback).activationReached).toBe(false);
  });

  it("returns null (not 0) for accept-rate and loop-closure with no denominator yet", () => {
    const rates = computeMetricRates(counters(), noFeedback);
    expect(rates.acceptRatePct).toBeNull();
    expect(rates.loopClosurePct).toBeNull();
  });

  it("computes accept-rate as accepted/analyzed x 100", () => {
    const rates = computeMetricRates(counters({ opportunitiesAnalyzed: 4, opportunitiesAccepted: 1 }), noFeedback);
    expect(rates.acceptRatePct).toBeCloseTo(25, 5);
  });

  it("computes loop-closure as shipped/accepted x 100", () => {
    const rates = computeMetricRates(counters({ opportunitiesAccepted: 4, opportunitiesShipped: 2 }), noFeedback);
    expect(rates.loopClosurePct).toBeCloseTo(50, 5);
  });

  it("loop-closure stays null even if something was shipped, when nothing was ever accepted", () => {
    // shouldn't happen in practice (you can't ship what wasn't accepted), but
    // guards the division regardless
    const rates = computeMetricRates(counters({ opportunitiesAccepted: 0, opportunitiesShipped: 0 }), noFeedback);
    expect(rates.loopClosurePct).toBeNull();
  });

  it("returns null for thumbs-up rate when no feedback has been given yet", () => {
    expect(computeMetricRates(counters(), noFeedback).thumbsUpRatePct).toBeNull();
  });

  it("computes thumbs-up rate as up-votes / total votes x 100, across all nodes voted on", () => {
    const feedback: Record<string, Thumb> = { a: "up", b: "up", c: "down", d: "up" };
    const rates = computeMetricRates(counters(), feedback);
    expect(rates.thumbsUpRatePct).toBeCloseTo(75, 5);
  });

  it("treats an all-down feedback set as 0%, not null", () => {
    const feedback: Record<string, Thumb> = { a: "down", b: "down" };
    const rates = computeMetricRates(counters(), feedback);
    expect(rates.thumbsUpRatePct).toBe(0);
  });
});
