import type { Opportunity, ROI } from "../types";

// A placeholder assumption until the buyer supplies a real figure (see
// weft-prd.md §13, open decision 4) — surfaced and editable in RoiPanel so
// money-saved never claims more precision than it has.
export const DEFAULT_HOURLY_COST = 50;

// Aggregates only shipped opportunities: shipped count, hours actually
// realized, money saved at the given hourly cost, and estimate-vs-actual
// accuracy (100% = the estimate was spot on; under/over shows the ROI story
// isn't just vanity numbers). Pure function — no storage access.
export function computeRoi(opportunities: Opportunity[], hourlyCost: number = DEFAULT_HOURLY_COST): ROI {
  const shipped = opportunities.filter((o) => o.status === "shipped");

  const shippedCount = shipped.length;
  const hoursSaved = shipped.reduce((sum, o) => sum + (o.realizedSavingHrs ?? 0), 0);
  const moneySaved = hoursSaved * hourlyCost;
  const estimatedForShipped = shipped.reduce((sum, o) => sum + o.estimatedSavingHrs, 0);
  const estimateVsActualPct = estimatedForShipped > 0 ? (hoursSaved / estimatedForShipped) * 100 : 0;

  return { shippedCount, hoursSaved, moneySaved, estimateVsActualPct };
}
