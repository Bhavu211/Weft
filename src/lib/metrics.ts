import type { Thumb } from "../types";

const METRICS_KEY = "weft_metrics";

export interface MetricCounters {
  reachedFirstMergedMap: boolean;
  opportunitiesAnalyzed: number;
  opportunitiesAccepted: number;
  opportunitiesShipped: number;
}

const EMPTY_COUNTERS: MetricCounters = {
  reachedFirstMergedMap: false,
  opportunitiesAnalyzed: 0,
  opportunitiesAccepted: 0,
  opportunitiesShipped: 0,
};

export async function getMetricCounters(): Promise<MetricCounters> {
  const result = await chrome.storage.local.get(METRICS_KEY);
  return { ...EMPTY_COUNTERS, ...(result[METRICS_KEY] ?? {}) };
}

async function updateCounters(delta: (counters: MetricCounters) => Partial<MetricCounters>): Promise<void> {
  const current = await getMetricCounters();
  await chrome.storage.local.set({ [METRICS_KEY]: { ...current, ...delta(current) } });
}

// Activation: "% of installs reaching a first (merged) map" (weft-prd.md
// §11). A flag, not a counter — re-merging doesn't inflate it.
export async function recordFirstMergedMap(): Promise<void> {
  await updateCounters(() => ({ reachedFirstMergedMap: true }));
}

// Denominator for accept-rate: an opportunity step the user actually opened
// the analysis panel for.
export async function recordOpportunityAnalyzed(): Promise<void> {
  await updateCounters((c) => ({ opportunitiesAnalyzed: c.opportunitiesAnalyzed + 1 }));
}

export async function recordOpportunityAccepted(): Promise<void> {
  await updateCounters((c) => ({ opportunitiesAccepted: c.opportunitiesAccepted + 1 }));
}

export async function recordOpportunityShipped(): Promise<void> {
  await updateCounters((c) => ({ opportunitiesShipped: c.opportunitiesShipped + 1 }));
}

export interface MetricRates {
  activationReached: boolean;
  acceptRatePct: number | null; // null, not 0, when there's no denominator yet
  loopClosurePct: number | null;
  thumbsUpRatePct: number | null;
}

// Pure — derives the PRD's rates from raw counters and the feedback map
// (weft-prd.md §11: activation, discovery quality/thumbs-up rate,
// accept-rate, and loop-closure — "the health metric, where prior tools
// died"). Returns null instead of a misleading 0% when the denominator is
// still zero.
export function computeMetricRates(counters: MetricCounters, feedback: Record<string, Thumb>): MetricRates {
  const votes = Object.values(feedback);

  return {
    activationReached: counters.reachedFirstMergedMap,
    acceptRatePct:
      counters.opportunitiesAnalyzed > 0
        ? (counters.opportunitiesAccepted / counters.opportunitiesAnalyzed) * 100
        : null,
    loopClosurePct:
      counters.opportunitiesAccepted > 0
        ? (counters.opportunitiesShipped / counters.opportunitiesAccepted) * 100
        : null,
    thumbsUpRatePct: votes.length > 0 ? (votes.filter((v) => v === "up").length / votes.length) * 100 : null,
  };
}
