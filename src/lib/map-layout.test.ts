import { describe, expect, it } from "vitest";
import { BRANCH_SPACING_Y, ORDER_SPACING_X, layoutMergedNodes } from "./map-layout";
import type { MergedNode } from "../types";

function node(overrides: Partial<MergedNode>): MergedNode {
  return {
    id: "n",
    order: 0,
    label: "Step",
    system: "erp.internal",
    signature: "entry",
    isCrossSystem: false,
    occurrence: 1,
    totalSessions: 1,
    isMainPath: true,
    avgDurationMs: 1000,
    intervention: "Keep manual",
    effort: 1,
    impact: 1,
    isOpportunity: false,
    isBottleneck: false,
    isException: false,
    suggestionText: "",
    estimatedSavingHrsPerMonth: 0,
    ...overrides,
  };
}

describe("layoutMergedNodes", () => {
  it("places nodes at successive orders along the x axis", () => {
    const nodes = [node({ id: "a", order: 0 }), node({ id: "b", order: 1 }), node({ id: "c", order: 2 })];
    const positions = layoutMergedNodes(nodes);

    expect(positions.a).toEqual({ x: 0, y: 0 });
    expect(positions.b).toEqual({ x: ORDER_SPACING_X, y: 0 });
    expect(positions.c).toEqual({ x: ORDER_SPACING_X * 2, y: 0 });
  });

  it("stacks the main path above branch siblings sharing an order", () => {
    const nodes = [
      node({ id: "branch", order: 1, isMainPath: false }),
      node({ id: "main", order: 1, isMainPath: true }),
    ];
    const positions = layoutMergedNodes(nodes);

    expect(positions.main).toEqual({ x: ORDER_SPACING_X, y: 0 });
    expect(positions.branch).toEqual({ x: ORDER_SPACING_X, y: BRANCH_SPACING_Y });
  });
});
