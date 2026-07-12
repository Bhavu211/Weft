import { merge } from "../reconstruct/merge";
import type { Session } from "../types";

export interface ExecutiveSummary {
  totalWorkflows: number;
  totalUsersObserved: number;
  totalSessionsRecorded: number;
  totalProcessVariants: number;
  automationOpportunitiesDiscovered: number;
  estimatedMonthlyHoursSaved: number;
  estimatedAnnualSavings: number;
}

// Pure — aggregates across every workflow, not just the one currently named
// in the side panel. Re-merges each workflow's reviewed sessions to derive
// variant/opportunity counts, so this always reflects the same alignment
// logic the map itself uses (no separate, potentially-drifting math).
export function computeExecutiveSummary(allSessions: Session[], hourlyCost: number): ExecutiveSummary {
  const reviewed = allSessions.filter((s) => s.reviewed);

  const sessionsByWorkflow = new Map<string, Session[]>();
  for (const session of reviewed) {
    const list = sessionsByWorkflow.get(session.workflowId) ?? [];
    list.push(session);
    sessionsByWorkflow.set(session.workflowId, list);
  }

  let totalProcessVariants = 0;
  let automationOpportunitiesDiscovered = 0;
  let estimatedMonthlyHoursSaved = 0;

  for (const sessions of sessionsByWorkflow.values()) {
    const result = merge(sessions);
    totalProcessVariants += result.nodes.filter((n) => !n.isMainPath).length;
    const opportunityNodes = result.nodes.filter((n) => n.isOpportunity);
    automationOpportunitiesDiscovered += opportunityNodes.length;
    estimatedMonthlyHoursSaved += opportunityNodes.reduce((sum, n) => sum + n.estimatedSavingHrsPerMonth, 0);
  }

  return {
    totalWorkflows: sessionsByWorkflow.size,
    // Weft never captures individual identity — a session carries no user
    // id, by design (see CLAUDE.md's "no individual performance metrics").
    // This is always "1" (this local install), not a real multi-user count.
    totalUsersObserved: 1,
    totalSessionsRecorded: allSessions.length,
    totalProcessVariants,
    automationOpportunitiesDiscovered,
    estimatedMonthlyHoursSaved,
    estimatedAnnualSavings: estimatedMonthlyHoursSaved * hourlyCost * 12,
  };
}
