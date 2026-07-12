import { describe, expect, it } from "vitest";
import { computeMetricRates, type MetricCounters } from "./metrics";

function counters(overrides: Partial<MetricCounters> = {}): MetricCounters {
  return {
    reachedFirstMergedMap: false,
    opportunitiesAnalyzed: 0,
    opportunitiesAccepted: 0,
    opportunitiesShipped: 0,
    ...overrides,
  };
}

describe("computeMetricRates", () => {
  it("reports activation directly from the flag", () => {
    expect(computeMetricRates(counters({ reachedFirstMergedMap: true })).activationReached).toBe(true);
    expect(computeMetricRates(counters({ reachedFirstMergedMap: false })).activationReached).toBe(false);
  });

  it("returns null (not 0) for accept-rate and loop-closure with no denominator yet", () => {
    const rates = computeMetricRates(counters());
    expect(rates.acceptRatePct).toBeNull();
    expect(rates.loopClosurePct).toBeNull();
  });

  it("computes accept-rate as accepted/analyzed x 100", () => {
    const rates = computeMetricRates(counters({ opportunitiesAnalyzed: 4, opportunitiesAccepted: 1 }));
    expect(rates.acceptRatePct).toBeCloseTo(25, 5);
  });

  it("computes loop-closure as shipped/accepted x 100", () => {
    const rates = computeMetricRates(counters({ opportunitiesAccepted: 4, opportunitiesShipped: 2 }));
    expect(rates.loopClosurePct).toBeCloseTo(50, 5);
  });

  it("loop-closure stays null even if something was shipped, when nothing was ever accepted", () => {
    // shouldn't happen in practice (you can't ship what wasn't accepted), but
    // guards the division regardless
    const rates = computeMetricRates(counters({ opportunitiesAccepted: 0, opportunitiesShipped: 0 }));
    expect(rates.loopClosurePct).toBeNull();
  });
});
