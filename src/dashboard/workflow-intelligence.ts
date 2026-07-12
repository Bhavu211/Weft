import { merge } from "../reconstruct/merge";
import type { MergeResult, Session } from "../types";

export interface WorkflowSummary {
  workflowId: string;
  sessionCount: number;
  avgCompletionTimeMs: number;
  variantCount: number;
  bottleneckCount: number;
  // Effort-3 steps (judgment_text / approval_decision / exception_branch) —
  // the heaviest human-effort signatures in taxonomy.ts, distinct from
  // isBottleneck (a wait/handoff delay) and isOpportunity (broader
  // automatable set that also includes lighter-effort steps).
  manualHotspotCount: number;
  mergeResult: MergeResult;
}

export function computeWorkflowIntelligence(allSessions: Session[]): WorkflowSummary[] {
  const reviewed = allSessions.filter((s) => s.reviewed);
  const sessionsByWorkflow = new Map<string, Session[]>();
  for (const session of reviewed) {
    const list = sessionsByWorkflow.get(session.workflowId) ?? [];
    list.push(session);
    sessionsByWorkflow.set(session.workflowId, list);
  }

  const summaries: WorkflowSummary[] = [];
  for (const [workflowId, sessions] of sessionsByWorkflow) {
    const mergeResult = merge(sessions);
    const completionTimes = sessions
      .filter((s) => s.endedAt !== undefined)
      .map((s) => s.endedAt! - s.startedAt);
    const avgCompletionTimeMs =
      completionTimes.length > 0 ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length : 0;

    summaries.push({
      workflowId,
      sessionCount: sessions.length,
      avgCompletionTimeMs,
      variantCount: mergeResult.nodes.filter((n) => !n.isMainPath).length,
      bottleneckCount: mergeResult.nodes.filter((n) => n.isBottleneck).length,
      manualHotspotCount: mergeResult.nodes.filter((n) => n.effort === 3).length,
      mergeResult,
    });
  }

  return summaries.sort((a, b) => b.sessionCount - a.sessionCount);
}
