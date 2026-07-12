import { describe, expect, it } from "vitest";
import { generateBrief } from "./generate-brief";
import { exportBriefJson, exportBriefMarkdown } from "./export-ticket";
import type { Opportunity } from "../types";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    stepId: "node-1-0",
    label: "Copy PAN & GST to KYC tool",
    system: "kyc.internal",
    signature: "copy_between_systems",
    isCrossSystem: true,
    intervention: "Integration / API bridge",
    suggestionText: "An API/integration bridge would remove this step almost entirely.",
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

describe("exportBriefJson", () => {
  it("produces valid, parseable JSON carrying the full brief", () => {
    const opp = opportunity();
    const brief = generateBrief(opp);
    const json = exportBriefJson(opp, brief);

    const parsed = JSON.parse(json);
    expect(parsed.title).toBe("Automate: Copy PAN & GST to KYC tool");
    expect(parsed.system).toBe("kyc.internal");
    expect(parsed.intervention).toBe("Integration / API bridge");
    expect(parsed.brief.problem).toBe(brief.problem);
    expect(parsed.brief.estimatedSavingHrs).toBe(12.5);
  });
});

describe("exportBriefMarkdown", () => {
  const opp = opportunity();
  const brief = generateBrief(opp);
  const markdown = exportBriefMarkdown(opp, brief);

  it("starts with a ticket-ready title", () => {
    expect(markdown.startsWith("# Automate: Copy PAN & GST to KYC tool")).toBe(true);
  });

  it("includes every brief section as a heading", () => {
    for (const heading of ["## Problem", "## Trigger", "## Inputs", "## Outputs", "## Recommended approach", "## Acceptance checklist"]) {
      expect(markdown).toContain(heading);
    }
  });

  it("renders an acceptance-style checkbox list mentioning the intervention", () => {
    expect(markdown).toContain("- [ ] Implement: Integration / API bridge");
    expect(markdown).toContain("- [ ] Confirm the exact field contents/values this step touches");
  });

  it("surfaces effort and estimated saving up top", () => {
    expect(markdown).toContain("**Effort:**");
    expect(markdown).toContain("**Estimated saving:** 12.5 hrs/month");
  });
});
