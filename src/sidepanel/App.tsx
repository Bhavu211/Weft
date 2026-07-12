import { useEffect, useState } from "react";
import CaptureControls from "./components/CaptureControls";
import StepList from "./components/StepList";
import PrivacyPreview from "./components/PrivacyPreview";
import WorkflowMap from "./components/WorkflowMap";
import AnalysisPanel from "./components/AnalysisPanel";
import Register from "./components/Register";
import MergedList from "./components/MergedList";
import BriefView from "./components/BriefView";
import RoiPanel from "./components/RoiPanel";
import ConsentScreen from "./components/ConsentScreen";
import {
  getReviewedSessionsForWorkflow,
  getRegister,
  getSession,
  saveRegister,
  getConsentAcknowledged,
  setConsentAcknowledged,
  getFeedback,
} from "../lib/storage";
import {
  getMetricCounters,
  computeMetricRates,
  recordFirstMergedMap,
  recordOpportunityAnalyzed,
  recordOpportunityAccepted,
  recordOpportunityShipped,
  type MetricRates,
} from "../lib/metrics";
import { merge } from "../reconstruct/merge";
import { generateBrief } from "../brief/generate-brief";
import type { ClassifiedStep, MergeResult, MergedNode, Opportunity } from "../types";
import type { ConfirmSessionResponse, DiscardSessionResponse } from "../background/messages";

export default function App() {
  const [consentAcknowledged, setConsentAcknowledgedState] = useState<boolean | null>(null);
  const [metricRates, setMetricRates] = useState<MetricRates | null>(null);
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

  useEffect(() => {
    getConsentAcknowledged().then(setConsentAcknowledgedState);
    refreshMetrics();
  }, []);

  async function refreshMetrics() {
    const [counters, feedback] = await Promise.all([getMetricCounters(), getFeedback()]);
    setMetricRates(computeMetricRates(counters, feedback));
  }

  async function handleAcknowledgeConsent() {
    await setConsentAcknowledged();
    setConsentAcknowledgedState(true);
  }

  async function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    const node = mergeResult?.nodes.find((n) => n.id === nodeId);
    if (node?.isOpportunity) {
      await recordOpportunityAnalyzed();
      await refreshMetrics();
    }
  }

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
    const result = merge(sessions);
    setMergeResult(result);
    setRegister(savedRegister);
    setSelectedNodeId(null);
    if (result.nodes.length > 0) {
      await recordFirstMergedMap();
      await refreshMetrics();
    }
  }

  async function handleAddToRegister(node: MergedNode) {
    const workflowId = workflowName.trim();
    if (!workflowId) return;
    const opportunity: Opportunity = {
      stepId: node.id,
      label: node.label,
      system: node.system,
      signature: node.signature,
      isCrossSystem: node.isCrossSystem,
      intervention: node.intervention,
      suggestionText: node.suggestionText,
      effort: node.effort,
      impact: node.impact,
      occurrence: node.occurrence,
      totalSessions: node.totalSessions,
      avgDurationMs: node.avgDurationMs,
      status: "identified",
      estimatedSavingHrs: node.estimatedSavingHrsPerMonth,
    };
    const next = [...register.filter((o) => o.stepId !== node.id), opportunity];
    setRegister(next);
    await saveRegister(workflowId, next);
    await recordOpportunityAccepted();
    await refreshMetrics();
  }

  async function handleRemoveFromRegister(stepId: string) {
    const workflowId = workflowName.trim();
    if (!workflowId) return;
    const next = register.filter((o) => o.stepId !== stepId);
    setRegister(next);
    await saveRegister(workflowId, next);
  }

  async function handleGenerateBrief(stepId: string) {
    const workflowId = workflowName.trim();
    if (!workflowId) return;
    const preSpecStatuses: Opportunity["status"][] = ["identified", "reviewed", "approved"];
    const next = register.map((o) => {
      if (o.stepId !== stepId) return o;
      return { ...o, brief: generateBrief(o), status: preSpecStatuses.includes(o.status) ? ("specced" as const) : o.status };
    });
    setRegister(next);
    await saveRegister(workflowId, next);
  }

  async function handleMarkShipped(stepId: string, realizedSavingHrs: number) {
    const workflowId = workflowName.trim();
    if (!workflowId) return;
    const next = register.map((o) =>
      o.stepId === stepId ? { ...o, status: "shipped" as const, realizedSavingHrs } : o
    );
    setRegister(next);
    await saveRegister(workflowId, next);
    await recordOpportunityShipped();
    await refreshMetrics();
  }

  const reconstructionFailed =
    pendingEventCount !== null && pendingEventCount > 0 && pendingSteps.length === 0;

  const selectedNode = mergeResult?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedOpportunity = selectedNode ? register.find((o) => o.stepId === selectedNode.id) ?? null : null;

  if (consentAcknowledged === null) return null;

  if (!consentAcknowledged) {
    return (
      <div className="app">
        <ConsentScreen onAcknowledge={handleAcknowledgeConsent} />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-header-row">
        <h1>Weft</h1>
        <button
          type="button"
          className="btn btn-dashboard"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/index.html") })}
        >
          Open Dashboard
        </button>
      </div>
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
            <WorkflowMap result={mergeResult} selectedNodeId={selectedNodeId} onSelectNode={handleSelectNode} />
            {selectedNode ? (
              <AnalysisPanel
                node={selectedNode}
                inRegister={Boolean(selectedOpportunity)}
                onAdd={() => handleAddToRegister(selectedNode)}
                onDismiss={() => handleRemoveFromRegister(selectedNode.id)}
                onVote={refreshMetrics}
              />
            ) : (
              <p className="muted">Click a step in the map to analyze it.</p>
            )}
            {selectedOpportunity ? (
              <BriefView
                opportunity={selectedOpportunity}
                brief={selectedOpportunity.brief ?? null}
                onGenerate={() => handleGenerateBrief(selectedOpportunity.stepId)}
                onShip={(realizedSavingHrs) => handleMarkShipped(selectedOpportunity.stepId, realizedSavingHrs)}
              />
            ) : null}
            <Register opportunities={register} onRemove={handleRemoveFromRegister} />
            <RoiPanel opportunities={register} />
            <details className="merge-review">
              <summary className="muted">Merge review (which steps were treated as the same)</summary>
              <MergedList result={mergeResult} />
            </details>
          </>
        ) : null}
      </div>
      {metricRates ? (
        <details className="metrics-panel">
          <summary className="muted">Metrics</summary>
          <ul className="metrics-list">
            <li className="muted">Activation (reached a first merged map): {metricRates.activationReached ? "yes" : "not yet"}</li>
            <li className="muted">
              Accept rate: {metricRates.acceptRatePct === null ? "not enough data yet" : `${metricRates.acceptRatePct.toFixed(0)}%`}
            </li>
            <li className="muted">
              Loop-closure rate: {metricRates.loopClosurePct === null ? "not enough data yet" : `${metricRates.loopClosurePct.toFixed(0)}%`}
            </li>
            <li className="muted">
              Discovery quality (thumbs-up rate): {metricRates.thumbsUpRatePct === null ? "not enough data yet" : `${metricRates.thumbsUpRatePct.toFixed(0)}%`}
            </li>
          </ul>
        </details>
      ) : null}
    </div>
  );
}
