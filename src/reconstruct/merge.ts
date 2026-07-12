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

// A step's identity for matching purposes — system + normalized label.
// Position is handled separately by alignment (see foldSessionIntoReference
// below), not baked into this key, so an insertion/deletion in one session
// doesn't stop its later steps from matching everyone else's.
function stepKey(step: ClassifiedStep): string {
  return `${step.domain}::${normalizeLabel(step.label)}`;
}

// One distinct step identity observed at a given position in the merged
// timeline. Most slots hold exactly one candidate; a slot holds more than
// one only where sessions genuinely diverged at that point.
interface Candidate {
  key: string;
  domain: string;
  label: string;
  signature: ClassifiedStep["signature"];
  isCrossSystem: boolean;
  occurrence: number;
  totalDurationMs: number;
  contributors: { sessionId: string; stepId: string }[];
}

// A position in the merged timeline. `order` in the final MergedNode comes
// from a slot's index, so sibling candidates at one slot render as branches
// at the same position (WorkflowMap/MergedList already group nodes this way).
interface Slot {
  candidates: Candidate[];
}

function newCandidate(sessionId: string, step: ClassifiedStep): Candidate {
  return {
    key: stepKey(step),
    domain: step.domain,
    label: step.label,
    signature: step.signature,
    isCrossSystem: step.isCrossSystem,
    occurrence: 1,
    totalDurationMs: step.durationMs,
    contributors: [{ sessionId, stepId: step.id }],
  };
}

function mergeIntoCandidate(candidate: Candidate, sessionId: string, step: ClassifiedStep): Candidate {
  return {
    ...candidate,
    occurrence: candidate.occurrence + 1,
    totalDurationMs: candidate.totalDurationMs + step.durationMs,
    contributors: [...candidate.contributors, { sessionId, stepId: step.id }],
  };
}

// Standard LCS dynamic program, except "equality" is "this reference slot
// already has a candidate with this key" rather than literal element
// equality — lets a session's step match a slot that holds several
// alternatives. Returns matched (slotIndex, stepIndex) pairs in order.
function computeAnchors(slotKeys: Set<string>[], stepKeys: string[]): [number, number][] {
  const m = slotKeys.length;
  const n = stepKeys.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = slotKeys[i - 1].has(stepKeys[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const anchors: [number, number][] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (slotKeys[i - 1].has(stepKeys[j - 1])) {
      anchors.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  anchors.reverse();
  return anchors;
}

// Folds one session's steps into the running reference timeline, aligning
// on step identity rather than raw position:
//   - matched steps merge into the existing slot's matching candidate.
//   - a gap facing a gap (neither side anchored — nothing before the next
//     match on either side lines up) is the branch itself: pair up
//     positions on each side, front to back, as sibling candidates on the
//     same slot, for as many positions as both sides have (a single-step
//     swap is just that with one position). If one side has more steps
//     than the other — the branch took a different number of steps to get
//     to the same reconvergence point — the extra steps on the longer side
//     continue right after the paired positions as their own slots, still
//     before the next anchor, rather than a pure insertion/deletion
//     (nothing paired at all) which just passes reference-only slots
//     through unchanged and appends session-only steps in order.
function foldSessionIntoReference(reference: Slot[], sessionId: string, steps: ClassifiedStep[]): Slot[] {
  const slotKeys = reference.map((slot) => new Set(slot.candidates.map((c) => c.key)));
  const stepKeys = steps.map(stepKey);
  const anchors = computeAnchors(slotKeys, stepKeys);

  const result: Slot[] = [];

  function appendGap(refFrom: number, refTo: number, stepFrom: number, stepTo: number) {
    const pairedLen = Math.min(refTo - refFrom, stepTo - stepFrom);

    for (let k = 0; k < pairedLen; k++) {
      const slot = reference[refFrom + k];
      const step = steps[stepFrom + k];
      result.push({ candidates: [...slot.candidates, newCandidate(sessionId, step)] });
    }

    for (let k = refFrom + pairedLen; k < refTo; k++) result.push(reference[k]);
    for (let k = stepFrom + pairedLen; k < stepTo; k++) result.push({ candidates: [newCandidate(sessionId, steps[k])] });
  }

  let refPtr = 0;
  let stepPtr = 0;
  for (const [refIdx, stepIdx] of anchors) {
    appendGap(refPtr, refIdx, stepPtr, stepIdx);
    const slot = reference[refIdx];
    const key = stepKeys[stepIdx];
    result.push({
      candidates: slot.candidates.map((c) => (c.key === key ? mergeIntoCandidate(c, sessionId, steps[stepIdx]) : c)),
    });
    refPtr = refIdx + 1;
    stepPtr = stepIdx + 1;
  }
  appendGap(refPtr, reference.length, stepPtr, steps.length);

  return result;
}

// Given every session recorded under one workflow name, segments + classifies
// each, then progressively aligns them into a single reference timeline
// (see foldSessionIntoReference). Shared steps collapse into one node
// (frequency = how many sessions took it); genuine divergences become
// sibling nodes at the same position, with the most common one flagged as
// the main path and low-frequency ones flagged as exceptions. Pure function
// — no storage access.
export function merge(sessions: Session[]): MergeResult {
  const totalSessions = sessions.length;
  const perSession = sessions.map((session) => ({
    sessionId: session.id,
    steps: classify(segment(session)),
  }));

  let reference: Slot[] = [];
  for (const { sessionId, steps } of perSession) {
    reference = foldSessionIntoReference(reference, sessionId, steps);
  }

  const nodes: MergedNode[] = [];
  const alignments: MergeAlignment[] = [];
  const nodeIdByContributor = new Map<string, string>();

  reference.forEach((slot, slotIndex) => {
    const sorted = [...slot.candidates].sort((a, b) => b.occurrence - a.occurrence);
    sorted.forEach((candidate, candidateIndex) => {
      const isMainPath = candidateIndex === 0;
      const frequency = totalSessions > 0 ? candidate.occurrence / totalSessions : 0;
      // "Exception" is inherently a comparison to an alternative — a lone
      // candidate with no sibling is just an optional step, not a divergence.
      const isException = slot.candidates.length > 1 && !isMainPath && frequency < EXCEPTION_FREQUENCY_THRESHOLD;

      const signature = isException ? "exception_branch" : candidate.signature;
      const avgDurationMs = candidate.totalDurationMs / candidate.occurrence;
      const taxonomy = taxonomyFor(signature);
      const estimatedSavingHrsPerMonth = estimateMonthlySavingHrs({
        avgDurationMs,
        automatableFraction: taxonomy.automatableFraction,
        occurrence: candidate.occurrence,
        totalSessions,
      });

      const id = `node-${slotIndex}-${candidateIndex}`;
      for (const c of candidate.contributors) nodeIdByContributor.set(`${c.sessionId}:${c.stepId}`, id);

      nodes.push({
        id,
        order: slotIndex,
        label: candidate.label,
        system: candidate.domain,
        signature,
        isCrossSystem: candidate.isCrossSystem,
        occurrence: candidate.occurrence,
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

      alignments.push({ nodeId: id, contributors: candidate.contributors });
    });
  });

  // Edges: replay each session's own step order against the final node-id
  // mapping (not the reference order), so a session that skipped or
  // detoured through steps still produces the edges it actually took.
  const edgeCounts = new Map<string, { from: string; to: string; occurrence: number }>();
  for (const { sessionId, steps } of perSession) {
    let prevNodeId: string | undefined;
    for (const step of steps) {
      const nodeId = nodeIdByContributor.get(`${sessionId}:${step.id}`);
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
