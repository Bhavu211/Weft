import { useState } from "react";
import CaptureControls from "./components/CaptureControls";
import StepList from "./components/StepList";
import PrivacyPreview from "./components/PrivacyPreview";
import MergedList from "./components/MergedList";
import { getReviewedSessionsForWorkflow, getSession } from "../lib/storage";
import { merge } from "../reconstruct/merge";
import type { ClassifiedStep, MergeResult } from "../types";
import type { ConfirmSessionResponse, DiscardSessionResponse } from "../background/messages";

export default function App() {
  const [workflowName, setWorkflowName] = useState("");
  const [steps, setSteps] = useState<ClassifiedStep[]>([]);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

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
    const sessions = await getReviewedSessionsForWorkflow(workflowId);
    setMergeResult(merge(sessions));
  }

  const reconstructionFailed =
    pendingEventCount !== null && pendingEventCount > 0 && pendingSteps.length === 0;

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
        {mergeResult ? <MergedList result={mergeResult} /> : null}
      </div>
    </div>
  );
}
