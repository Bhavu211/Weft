import { useState } from "react";
import WorkflowMap from "../../sidepanel/components/WorkflowMap";
import type { WorkflowSummary } from "../workflow-intelligence";

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export default function WorkflowIntelligence({ workflows }: { workflows: WorkflowSummary[] }) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(workflows[0]?.workflowId ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (workflows.length === 0) {
    return (
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Workflow Intelligence</h2>
        <p className="muted">
          No reviewed sessions yet — record a workflow at least twice, confirm each in the privacy
          preview, then merge, to see its map here.
        </p>
      </section>
    );
  }

  const selected = workflows.find((w) => w.workflowId === selectedWorkflowId) ?? workflows[0];

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Workflow Intelligence</h2>
      <div className="wf-tabs">
        {workflows.map((w) => (
          <button
            key={w.workflowId}
            type="button"
            className={`wf-tab ${w.workflowId === selected.workflowId ? "wf-tab-active" : ""}`}
            onClick={() => {
              setSelectedWorkflowId(w.workflowId);
              setSelectedNodeId(null);
            }}
          >
            {w.workflowId}
          </button>
        ))}
      </div>
      <div className="exec-grid wf-stats-grid">
        <div className="exec-tile">
          <div className="exec-tile-value">{selected.sessionCount}</div>
          <div className="exec-tile-label">Sessions (frequency)</div>
        </div>
        <div className="exec-tile">
          <div className="exec-tile-value">{formatDuration(selected.avgCompletionTimeMs)}</div>
          <div className="exec-tile-label">Avg completion time</div>
        </div>
        <div className="exec-tile">
          <div className="exec-tile-value">{selected.variantCount}</div>
          <div className="exec-tile-label">Process variants</div>
        </div>
        <div className="exec-tile">
          <div className="exec-tile-value">{selected.bottleneckCount}</div>
          <div className="exec-tile-label">Bottlenecks</div>
        </div>
        <div className="exec-tile">
          <div className="exec-tile-value">{selected.manualHotspotCount}</div>
          <div className="exec-tile-label">Manual hotspots</div>
        </div>
      </div>
      <WorkflowMap result={selected.mergeResult} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />
    </section>
  );
}
