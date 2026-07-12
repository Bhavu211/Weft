import { useEffect, useMemo, useState } from "react";
import ExecutiveSummary from "./components/ExecutiveSummary";
import WorkflowIntelligence from "./components/WorkflowIntelligence";
import AIOpportunityRegister from "./components/AIOpportunityRegister";
import AutomationPipeline from "./components/AutomationPipeline";
import AutomationBriefViewer from "./components/AutomationBriefViewer";
import { getAllRegisters, getAllSessions, getFeedback, getHourlyCost, saveRegister } from "../lib/storage";
import { computeExecutiveSummary, type ExecutiveSummary as ExecutiveSummaryData } from "./executive-summary";
import { computeWorkflowIntelligence, type WorkflowSummary } from "./workflow-intelligence";
import { computeAIOpportunityRegister } from "./ai-register";
import { advanceOpportunity, computeAutomationPipeline, statusAfterBriefGenerated } from "../lib/pipeline";
import { generateBrief } from "../brief/generate-brief";
import type { Opportunity, Thumb } from "../types";

// Dashboard 1 — Process Intelligence: "what should we automate?" Built one
// section at a time; Business KPIs arrives in a later milestone and gets
// added below as it's built, not all at once.
export default function Dashboard() {
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null);
  const [registers, setRegisters] = useState<Record<string, Opportunity[]> | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Thumb>>({});
  const [hourlyCost, setHourlyCost] = useState(0);

  useEffect(() => {
    async function load() {
      const [sessions, cost, allRegisters, allFeedback] = await Promise.all([
        getAllSessions(),
        getHourlyCost(),
        getAllRegisters(),
        getFeedback(),
      ]);
      setSummary(computeExecutiveSummary(sessions, cost));
      setWorkflows(computeWorkflowIntelligence(sessions));
      setRegisters(allRegisters);
      setFeedback(allFeedback);
      setHourlyCost(cost);
    }
    load();
  }, []);

  const registerEntries = useMemo(
    () => (registers ? computeAIOpportunityRegister(registers, feedback, hourlyCost) : null),
    [registers, feedback, hourlyCost]
  );
  const pipelineColumns = useMemo(() => (registers ? computeAutomationPipeline(registers) : null), [registers]);

  async function handleAdvance(workflowId: string, stepId: string) {
    if (!registers) return;
    const workflowRegister = registers[workflowId] ?? [];
    const nextWorkflowRegister = workflowRegister.map((o) => (o.stepId === stepId ? advanceOpportunity(o) : o));
    const nextRegisters = { ...registers, [workflowId]: nextWorkflowRegister };
    setRegisters(nextRegisters);
    await saveRegister(workflowId, nextWorkflowRegister);
  }

  async function handleGenerateBrief(workflowId: string, stepId: string) {
    if (!registers) return;
    const workflowRegister = registers[workflowId] ?? [];
    const nextWorkflowRegister = workflowRegister.map((o) =>
      o.stepId === stepId ? { ...o, brief: generateBrief(o), status: statusAfterBriefGenerated(o.status) } : o
    );
    const nextRegisters = { ...registers, [workflowId]: nextWorkflowRegister };
    setRegisters(nextRegisters);
    await saveRegister(workflowId, nextWorkflowRegister);
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Weft</h1>
        <p className="dashboard-subtitle">Process Intelligence — what should we automate?</p>
      </header>
      {summary ? <ExecutiveSummary summary={summary} /> : <p className="muted">Loading…</p>}
      {workflows ? <WorkflowIntelligence workflows={workflows} /> : null}
      {registerEntries ? <AIOpportunityRegister entries={registerEntries} /> : null}
      {pipelineColumns ? <AutomationPipeline columns={pipelineColumns} onAdvance={handleAdvance} /> : null}
      {registers ? <AutomationBriefViewer registers={registers} onGenerate={handleGenerateBrief} /> : null}
    </div>
  );
}
