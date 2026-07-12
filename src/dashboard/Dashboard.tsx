import { useEffect, useState } from "react";
import ExecutiveSummary from "./components/ExecutiveSummary";
import WorkflowIntelligence from "./components/WorkflowIntelligence";
import { getAllSessions, getHourlyCost } from "../lib/storage";
import { computeExecutiveSummary, type ExecutiveSummary as ExecutiveSummaryData } from "./executive-summary";
import { computeWorkflowIntelligence, type WorkflowSummary } from "./workflow-intelligence";

// Dashboard 1 — Process Intelligence: "what should we automate?" Built one
// section at a time; the AI Opportunity Register, the Automation Pipeline,
// the Automation Brief viewer, and Business KPIs arrive in later milestones
// and get added below as they're built, not all at once.
export default function Dashboard() {
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);

  useEffect(() => {
    async function load() {
      const [sessions, hourlyCost] = await Promise.all([getAllSessions(), getHourlyCost()]);
      setSummary(computeExecutiveSummary(sessions, hourlyCost));
      setWorkflows(computeWorkflowIntelligence(sessions));
    }
    load();
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Weft</h1>
        <p className="dashboard-subtitle">Process Intelligence — what should we automate?</p>
      </header>
      {summary ? <ExecutiveSummary summary={summary} /> : <p className="muted">Loading…</p>}
      {workflows ? <WorkflowIntelligence workflows={workflows} /> : null}
    </div>
  );
}
