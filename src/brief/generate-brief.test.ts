import { describe, expect, it } from "vitest";
import { generateBrief } from "./generate-brief";
import type { Opportunity } from "../types";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    stepId: "node-1-0",
    label: "Copy PAN & GST to KYC tool",
    system: "kyc.internal",
    signature: "copy_between_systems",
    isCrossSystem: true,
    intervention: "Integration / API bridge",
    suggestionText: "Data is copied by hand between systems here — an API/integration bridge would remove this step almost entirely.",
    effort: 2,
    impact: 3,
    occurrence: 3,
    totalSessions: 3,
    avgDurationMs: 45_000,
    status: "identified",
    estimatedSavingHrs: 12.5,
    ...overrides,
  };
}

describe("generateBrief", () => {
  it("grounds the problem statement in what was actually observed", () => {
    const brief = generateBrief(opportunity());

    expect(brief.problem).toContain("Copy PAN & GST to KYC tool");
    expect(brief.problem).toContain("kyc.internal");
    expect(brief.problem).toContain("copy between systems");
    expect(brief.problem).toContain("3/3 recorded sessions");
    expect(brief.problem).toContain("crossing systems by hand");
  });

  it("omits the cross-system phrase when the step didn't cross systems", () => {
    const brief = generateBrief(opportunity({ isCrossSystem: false }));
    expect(brief.problem).not.toContain("crossing systems by hand");
  });

  it("carries the intervention into outputs, suggestion into approach, and system into systems", () => {
    const opp = opportunity();
    const brief = generateBrief(opp);

    expect(brief.outputs).toContain(opp.intervention);
    expect(brief.approach).toBe(opp.suggestionText);
    expect(brief.systems).toEqual([opp.system]);
  });

  it("maps effort 1/2/3 to a human-readable estimate", () => {
    expect(generateBrief(opportunity({ effort: 1 })).effortEstimate).toMatch(/small/i);
    expect(generateBrief(opportunity({ effort: 2 })).effortEstimate).toMatch(/medium/i);
    expect(generateBrief(opportunity({ effort: 3 })).effortEstimate).toMatch(/large/i);
  });

  it("carries the estimated saving through unchanged", () => {
    const brief = generateBrief(opportunity({ estimatedSavingHrs: 7.25 }));
    expect(brief.estimatedSavingHrs).toBe(7.25);
  });

  it("never invents field values — inputs stays generic and flags that values weren't captured", () => {
    const brief = generateBrief(opportunity());
    expect(brief.inputs.toLowerCase()).toContain("never the values");
  });
});
