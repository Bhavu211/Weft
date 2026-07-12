// Default assumption for how many times a month this workflow runs at all.
// This is a placeholder until the user supplies a real figure — surfaced in
// the UI so the ROI story stays honest (see weft-prd.md §13, open decision 4).
export const DEFAULT_RUNS_PER_MONTH = 20;

export interface SavingsInput {
  avgDurationMs: number;
  automatableFraction: number;
  occurrence: number; // sessions that took this step
  totalSessions: number; // sessions in the merge
  runsPerMonth?: number;
}

// estimatedSavingHrsPerMonth = monthlyFrequency x hoursPerRun x automatableFraction.
// monthlyFrequency scales runsPerMonth down by how often this step actually
// occurs (occurrence/totalSessions) — a branch only a third of sessions took
// should only claim a third of the workflow's monthly runs, not all of them.
export function estimateMonthlySavingHrs(input: SavingsInput): number {
  const { avgDurationMs, automatableFraction, occurrence, totalSessions, runsPerMonth = DEFAULT_RUNS_PER_MONTH } =
    input;

  if (totalSessions <= 0) return 0;

  const frequencyFraction = occurrence / totalSessions;
  const monthlyFrequency = runsPerMonth * frequencyFraction;
  const hoursPerRun = avgDurationMs / 3.6e6;

  return monthlyFrequency * hoursPerRun * automatableFraction;
}
