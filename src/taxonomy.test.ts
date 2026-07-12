import { describe, expect, it } from "vitest";
import { taxonomyFor } from "./taxonomy";

// Cross-checks every row of the taxonomy table in BUILD.md — a mismatch
// here means this file has drifted from the spec, not that the spec is wrong.
describe("taxonomyFor", () => {
  it.each([
    ["entry", { effort: 1, impact: 1, isOpportunity: false, isBottleneck: false, automatableFraction: 0 }],
    ["repetitive", { effort: 2, impact: 2, isOpportunity: true, isBottleneck: false, automatableFraction: 0.9 }],
    [
      "copy_between_systems",
      { effort: 2, impact: 3, isOpportunity: true, isBottleneck: false, automatableFraction: 0.95 },
    ],
    [
      "lookup_verification",
      { effort: 2, impact: 3, isOpportunity: true, isBottleneck: false, automatableFraction: 0.8 },
    ],
    ["judgment_text", { effort: 3, impact: 3, isOpportunity: true, isBottleneck: false, automatableFraction: 0.5 }],
    ["wait_handoff", { effort: 1, impact: 3, isOpportunity: false, isBottleneck: true, automatableFraction: 0 }],
    [
      "approval_decision",
      { effort: 3, impact: 2, isOpportunity: true, isBottleneck: false, automatableFraction: 0.6 },
    ],
    [
      "exception_branch",
      { effort: 3, impact: 3, isOpportunity: true, isBottleneck: false, automatableFraction: 0.6 },
    ],
  ] as const)("%s matches the BUILD.md taxonomy row", (signature, expected) => {
    const entry = taxonomyFor(signature);
    expect(entry.effort).toBe(expected.effort);
    expect(entry.impact).toBe(expected.impact);
    expect(entry.isOpportunity).toBe(expected.isOpportunity);
    expect(entry.isBottleneck).toBe(expected.isBottleneck);
    expect(entry.automatableFraction).toBe(expected.automatableFraction);
    expect(entry.intervention.length).toBeGreaterThan(0);
    expect(entry.suggestionText.length).toBeGreaterThan(0);
  });
});
