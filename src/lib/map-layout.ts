import type { MergedNode } from "../types";

export const ORDER_SPACING_X = 220;
export const BRANCH_SPACING_Y = 110;

export interface NodePosition {
  x: number;
  y: number;
}

// Simple layered layout: x by step order, y by position among the siblings
// that share that order (main path first, branches stacked below it). No
// layout library — this is legible and cheap, matching the rest of the
// reconstruction pipeline's design bias toward simple-and-debuggable.
export function layoutMergedNodes(nodes: MergedNode[]): Record<string, NodePosition> {
  const byOrder = new Map<number, MergedNode[]>();
  for (const node of nodes) {
    const list = byOrder.get(node.order) ?? [];
    list.push(node);
    byOrder.set(node.order, list);
  }
  for (const list of byOrder.values()) {
    list.sort((a, b) => Number(b.isMainPath) - Number(a.isMainPath));
  }

  const positions: Record<string, NodePosition> = {};
  for (const node of nodes) {
    const siblings = byOrder.get(node.order)!;
    const indexAmongSiblings = siblings.indexOf(node);
    positions[node.id] = { x: node.order * ORDER_SPACING_X, y: indexAmongSiblings * BRANCH_SPACING_Y };
  }
  return positions;
}
