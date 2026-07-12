import { segment } from "./segment";
import { classify } from "./classify";
import { taxonomyFor } from "../taxonomy";
import { estimateMonthlySavingHrs } from "./savings";
import type { ClassifiedStep, Edge, MergeAlignment, MergeResult, MergedNode, Session } from "../types";

// A branch present in fewer than half of sessions is a candidate exception
// rather than a genuine even fork (see weft-prd.md FR-6).
const EXCEPTION_FREQUENCY_THRESHOLD = 0.5;

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

// Two steps merge into one node only if they share system + normalized
// label + order. This is legible and cheap, but literal: a session that
// inserts an extra step shifts every later step's order in that session, so
// they stop matching the sessions that didn't take the detour. That's a
// known MVP limitation (weft-prd.md §13, open decision 3) — the fix is a
// merge-review surface (see `alignments` below), not a smarter key here.
function stepKey(step: ClassifiedStep): string {
  return `${step.domain}::${normalizeLabel(step.label)}::${step.order}`;
}

interface Contribution {
  sessionId: string;
  step: ClassifiedStep;
}

// Given every session recorded under one workflow name, segments + classifies
// each, aligns their steps by key, and produces a main-path-plus-branches
// graph: shared steps collapse into one node (frequency = how many sessions
// took it); divergent steps become sibling nodes at the same position, with
// the most common one flagged as the main path and low-frequency ones
// flagged as exceptions. Pure function — no storage access.
export function merge(sessions: Session[]): MergeResult {
  const totalSessions = sessions.length;
  const perSession = sessions.map((session) => ({
    sessionId: session.id,
    steps: classify(segment(session)),
  }));

  const groupsByKey = new Map<string, Contribution[]>();
  for (const { sessionId, steps } of perSession) {
    for (const step of steps) {
      const key = stepKey(step);
      const group = groupsByKey.get(key) ?? [];
      group.push({ sessionId, step });
      groupsByKey.set(key, group);
    }
  }

  const groupsByOrder = new Map<number, { key: string; contributions: Contribution[] }[]>();
  for (const [key, contributions] of groupsByKey) {
    const order = contributions[0].step.order;
    const list = groupsByOrder.get(order) ?? [];
    list.push({ key, contributions });
    groupsByOrder.set(order, list);
  }

  const nodes: MergedNode[] = [];
  const alignments: MergeAlignment[] = [];
  const nodeIdByKey = new Map<string, string>();

  const orders = [...groupsByOrder.keys()].sort((a, b) => a - b);
  for (const order of orders) {
    // The most-contributed-to group at this position is the main path;
    // every other group at the same position is a sibling branch.
    const groupsAtOrder = [...groupsByOrder.get(order)!].sort(
      (a, b) => b.contributions.length - a.contributions.length
    );

    groupsAtOrder.forEach(({ key, contributions }, i) => {
      const isMainPath = i === 0;
      const occurrence = contributions.length;
      const frequency = totalSessions > 0 ? occurrence / totalSessions : 0;
      const isException = !isMainPath && frequency < EXCEPTION_FREQUENCY_THRESHOLD;

      const representative = contributions[0].step;
      const avgDurationMs =
        contributions.reduce((sum, c) => sum + c.step.durationMs, 0) / contributions.length;
      const signature = isException ? "exception_branch" : representative.signature;
      const taxonomy = taxonomyFor(signature);
      const estimatedSavingHrsPerMonth = estimateMonthlySavingHrs({
        avgDurationMs,
        automatableFraction: taxonomy.automatableFraction,
        occurrence,
        totalSessions,
      });

      const id = `node-${order}-${i}`;
      nodeIdByKey.set(key, id);

      nodes.push({
        id,
        order,
        label: representative.label,
        system: representative.domain,
        signature,
        isCrossSystem: representative.isCrossSystem,
        occurrence,
        totalSessions,
        isMainPath,
        avgDurationMs,
        intervention: taxonomy.intervention,
        effort: taxonomy.effort,
        impact: taxonomy.impact,
        isOpportunity: taxonomy.isOpportunity,
        isBottleneck: taxonomy.isBottleneck,
        isException,
        suggestionText: taxonomy.suggestionText,
        estimatedSavingHrsPerMonth,
      });

      alignments.push({
        nodeId: id,
        contributors: contributions.map((c) => ({ sessionId: c.sessionId, stepId: c.step.id })),
      });
    });
  }

  const edgeCounts = new Map<string, { from: string; to: string; occurrence: number }>();
  for (const { steps } of perSession) {
    let prevNodeId: string | undefined;
    for (const step of steps) {
      const nodeId = nodeIdByKey.get(stepKey(step));
      if (!nodeId) continue;
      if (prevNodeId) {
        const edgeKey = `${prevNodeId}->${nodeId}`;
        const entry = edgeCounts.get(edgeKey) ?? { from: prevNodeId, to: nodeId, occurrence: 0 };
        entry.occurrence += 1;
        edgeCounts.set(edgeKey, entry);
      }
      prevNodeId = nodeId;
    }
  }

  const edges: Edge[] = [...edgeCounts.values()].map((e, i) => ({
    id: `edge-${i}`,
    from: e.from,
    to: e.to,
    occurrence: e.occurrence,
    totalSessions,
  }));

  return { nodes, edges, alignments, totalSessions };
}
