import { useState } from "react";
import CaptureControls from "./components/CaptureControls";
import StepList from "./components/StepList";
import PrivacyPreview from "./components/PrivacyPreview";
import WorkflowMap from "./components/WorkflowMap";
import AnalysisPanel from "./components/AnalysisPanel";
import Register from "./components/Register";
import MergedList from "./components/MergedList";
import { getReviewedSessionsForWorkflow, getRegister, getSession, saveRegister } from "../lib/storage";
import { merge } from "../reconstruct/merge";
import type { ClassifiedStep, MergeResult, MergedNode, Opportunity } from "../types";
import type { ConfirmSessionResponse, DiscardSessionResponse } from "../background/messages";

export default function App() {
  const [workflowName, setWorkflowName] = useState("");
  const [steps, setSteps] = useState<ClassifiedStep[]>([]);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [register, setRegister] = useState<Opportunity[]>([]);

  // A stopped session sits here, unreviewed, until the user confirms or
  // discards it in the privacy preview — nothing here counts as saved yet.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingSteps, setPendingSteps] = useState<ClassifiedStep[]>([]);
  const [pendingEventCount, setPendingEventCount] = useState<number | null>(null);

  async function handleStopped(sessionId: string) {
    const session = await getSession(sessionId);
    setPendingSessionId(sessionId);
    setPendingSteps(session?.steps ?? []);
    setPendingEventCount(session?.events.length ?? null);
  }

  function clearPending() {
    setPendingSessionId(null);
    setPendingSteps([]);
    setPendingEventCount(null);
  }

  async function handleConfirm(labelEdits: Record<string, string>) {
    if (!pendingSessionId) return;
    const res: ConfirmSessionResponse = await chrome.runtime.sendMessage({
      type: "CONFIRM_SESSION",
      sessionId: pendingSessionId,
      labelEdits,
    });
    if (res.confirmed) {
      setSteps(pendingSteps.map((step) => (step.id in labelEdits ? { ...step, label: labelEdits[step.id] } : step)));
    }
    clearPending();
  }

  async function handleDiscard() {
    if (!pendingSessionId) return;
    const res: DiscardSessionResponse = await chrome.runtime.sendMessage({
      type: "DISCARD_SESSION",
      sessionId: pendingSessionId,
    });
    if (res.discarded) setSteps([]);
    clearPending();
  }

  async function handleMerge() {
    const workflowId = workflowName.trim();
    if (!workflowId) return;
    const [sessions, savedRegister] = await Promise.all([
      getReviewedSessionsForWorkflow(workflowId),
      getRegister(workflowId),
    ]);
    setMergeResult(merge(sessions));
    setRegister(savedRegister);
    setSelectedNodeId(null);
  }

  async function handleAddToRegister(node: MergedNode) {
    const workflowId = workflowName.trim();
    if (!workflowId) return;
    const opportunity: Opportunity = {
      stepId: node.id,
      label: node.label,
      intervention: node.intervention,
      impact: node.impact,
      status: "identified",
      estimatedSavingHrs: node.estimatedSavingHrsPerMonth,
    };
    const next = [...register.filter((o) => o.stepId !== node.id), opportunity];
    setRegister(next);
    await saveRegister(workflowId, next);
  }

  async function handleRemoveFromRegister(stepId: string) {
    const workflowId = workflowName.trim();
    if (!workflowId) return;
    const next = register.filter((o) => o.stepId !== stepId);
    setRegister(next);
    await saveRegister(workflowId, next);
  }

  const reconstructionFailed =
    pendingEventCount !== null && pendingEventCount > 0 && pendingSteps.length === 0;

  const selectedNode = mergeResult?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedInRegister = selectedNode ? register.some((o) => o.stepId === selectedNode.id) : false;

  return (
    <div className="app">
      <h1>Weft</h1>
      <label className="workflow-name-label" htmlFor="workflow-name">
        Workflow
      </label>
      <input
        id="workflow-name"
        className="workflow-name-input"
        placeholder="e.g. partner onboarding"
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
      />
      <CaptureControls workflowId={workflowName} onStopped={handleStopped} />
      {pendingSessionId ? (
        reconstructionFailed ? (
          <div>
            <p className="muted">
              Session saved ({pendingEventCount} events), but step reconstruction failed —
              see the service worker console.
            </p>
            <button type="button" className="btn btn-discard" onClick={handleDiscard}>
              Discard session
            </button>
          </div>
        ) : (
          <PrivacyPreview steps={pendingSteps} onConfirm={handleConfirm} onDiscard={handleDiscard} />
        )
      ) : (
        <StepList steps={steps} />
      )}
      <div className="merge-section">
        <button type="button" className="btn btn-merge" onClick={handleMerge} disabled={!workflowName.trim()}>
          Merge recorded sessions
        </button>
        {mergeResult ? (
          <>
            <WorkflowMap result={mergeResult} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
            {selectedNode ? (
              <AnalysisPanel
                node={selectedNode}
                inRegister={selectedInRegister}
                onAdd={() => handleAddToRegister(selectedNode)}
                onDismiss={() => handleRemoveFromRegister(selectedNode.id)}
              />
            ) : (
              <p className="muted">Click a step in the map to analyze it.</p>
            )}
            <Register opportunities={register} onRemove={handleRemoveFromRegister} />
            <details className="merge-review">
              <summary className="muted">Merge review (which steps were treated as the same)</summary>
              <MergedList result={mergeResult} />
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}
