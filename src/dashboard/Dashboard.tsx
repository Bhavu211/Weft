import { useEffect, useState } from "react";
import ExecutiveSummary from "./components/ExecutiveSummary";
import WorkflowIntelligence from "./components/WorkflowIntelligence";
import AIOpportunityRegister from "./components/AIOpportunityRegister";
import { getAllRegisters, getAllSessions, getFeedback, getHourlyCost } from "../lib/storage";
import { computeExecutiveSummary, type ExecutiveSummary as ExecutiveSummaryData } from "./executive-summary";
import { computeWorkflowIntelligence, type WorkflowSummary } from "./workflow-intelligence";
import { computeAIOpportunityRegister, type RegisterEntry } from "./ai-register";

// Dashboard 1 — Process Intelligence: "what should we automate?" Built one
// section at a time; the Automation Pipeline, the Automation Brief viewer,
// and Business KPIs arrive in later milestones and get added below as
// they're built, not all at once.
export default function Dashboard() {
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [registerEntries, setRegisterEntries] = useState<RegisterEntry[] | null>(null);

  useEffect(() => {
    async function load() {
      const [sessions, hourlyCost, registers, feedback] = await Promise.all([
        getAllSessions(),
        getHourlyCost(),
        getAllRegisters(),
        getFeedback(),
      ]);
      setSummary(computeExecutiveSummary(sessions, hourlyCost));
      setWorkflows(computeWorkflowIntelligence(sessions));
      setRegisterEntries(computeAIOpportunityRegister(registers, feedback, hourlyCost));
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
      {registerEntries ? <AIOpportunityRegister entries={registerEntries} /> : null}
    </div>
  );
}
