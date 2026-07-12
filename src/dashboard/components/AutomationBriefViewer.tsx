import { useState } from "react";
import type { Opportunity } from "../../types";
import { exportBriefJson, exportBriefMarkdown } from "../../brief/export-ticket";

interface FlatOpportunity {
  workflowId: string;
  opportunity: Opportunity;
}

function flattenRegisters(registers: Record<string, Opportunity[]>): FlatOpportunity[] {
  const flat: FlatOpportunity[] = [];
  for (const [workflowId, opportunities] of Object.entries(registers)) {
    for (const opportunity of opportunities) flat.push({ workflowId, opportunity });
  }
  return flat;
}

export default function AutomationBriefViewer({
  registers,
  onGenerate,
}: {
  registers: Record<string, Opportunity[]>;
  onGenerate: (workflowId: string, stepId: string) => void;
}) {
  const flatOpportunities = flattenRegisters(registers);
  const [selectedKey, setSelectedKey] = useState<string | null>(flatOpportunities[0]
    ? `${flatOpportunities[0].workflowId}::${flatOpportunities[0].opportunity.stepId}`
    : null);
  const [copied, setCopied] = useState<"json" | "markdown" | null>(null);

  if (flatOpportunities.length === 0) {
    return (
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Automation Brief</h2>
        <p className="muted">
          No opportunities in the register yet — add one to a workflow's register to generate a
          brief for it here.
        </p>
      </section>
    );
  }

  const selected = flatOpportunities.find(
    (f) => `${f.workflowId}::${f.opportunity.stepId}` === selectedKey
  ) ?? flatOpportunities[0];
  const { workflowId, opportunity } = selected;
  const brief = opportunity.brief ?? null;

  async function copy(format: "json" | "markdown") {
    if (!brief) return;
    const text = format === "json" ? exportBriefJson(opportunity, brief) : exportBriefMarkdown(opportunity, brief);
    await navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied((current) => (current === format ? null : current)), 1500);
  }

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Automation Brief</h2>
      <div className="brief-picker">
        <select
          className="brief-picker-select"
          value={selectedKey ?? ""}
          onChange={(e) => setSelectedKey(e.target.value)}
        >
          {flatOpportunities.map((f) => (
            <option key={`${f.workflowId}::${f.opportunity.stepId}`} value={`${f.workflowId}::${f.opportunity.stepId}`}>
              {f.workflowId} — {f.opportunity.label}
            </option>
          ))}
        </select>
      </div>

      {!brief ? (
        <button type="button" className="btn btn-confirm" onClick={() => onGenerate(workflowId, opportunity.stepId)}>
          Generate brief
        </button>
      ) : (
        <>
          <dl className="brief-fields">
            <div>
              <dt className="muted">Problem</dt>
              <dd>{brief.problem}</dd>
            </div>
            <div>
              <dt className="muted">Trigger</dt>
              <dd>{brief.trigger}</dd>
            </div>
            <div>
              <dt className="muted">Inputs</dt>
              <dd>{brief.inputs}</dd>
            </div>
            <div>
              <dt className="muted">Outputs</dt>
              <dd>{brief.outputs}</dd>
            </div>
            <div>
              <dt className="muted">Systems</dt>
              <dd>{brief.systems.join(", ")}</dd>
            </div>
            <div>
              <dt className="muted">Recommended approach</dt>
              <dd>{brief.approach}</dd>
            </div>
            <div>
              <dt className="muted">Effort estimate</dt>
              <dd>{brief.effortEstimate}</dd>
            </div>
            <div>
              <dt className="muted">Estimated saving</dt>
              <dd>{brief.estimatedSavingHrs.toFixed(1)} hrs/month</dd>
            </div>
          </dl>
          <div className="brief-actions">
            <button type="button" className="btn btn-export" onClick={() => copy("json")}>
              {copied === "json" ? "Copied JSON" : "Copy JSON"}
            </button>
            <button type="button" className="btn btn-export" onClick={() => copy("markdown")}>
              {copied === "markdown" ? "Copied Markdown" : "Copy Markdown ticket"}
            </button>
            <button
              type="button"
              className="btn btn-merge"
              onClick={() => onGenerate(workflowId, opportunity.stepId)}
            >
              Regenerate
            </button>
          </div>
        </>
      )}
    </section>
  );
}
