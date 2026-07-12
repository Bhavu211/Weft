import { useState } from "react";
import type { AutomationBrief, Opportunity } from "../../types";
import { exportBriefJson, exportBriefMarkdown } from "../../brief/export-ticket";

export default function BriefView({
  opportunity,
  brief,
  onGenerate,
}: {
  opportunity: Opportunity;
  brief: AutomationBrief | null;
  onGenerate: () => void;
}) {
  const [copied, setCopied] = useState<"json" | "markdown" | null>(null);

  async function copy(format: "json" | "markdown") {
    if (!brief) return;
    const text = format === "json" ? exportBriefJson(opportunity, brief) : exportBriefMarkdown(opportunity, brief);
    await navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied((current) => (current === format ? null : current)), 1500);
  }

  return (
    <div className="brief-view">
      <div className="analysis-eyebrow muted">Automation brief</div>
      {!brief ? (
        <button type="button" className="btn btn-confirm" onClick={onGenerate}>
          Generate brief
        </button>
      ) : (
        <>
          <h3>{opportunity.label}</h3>
          <dl className="brief-fields">
            <div>
              <dt className="analysis-flabel muted">Problem</dt>
              <dd>{brief.problem}</dd>
            </div>
            <div>
              <dt className="analysis-flabel muted">Trigger</dt>
              <dd>{brief.trigger}</dd>
            </div>
            <div>
              <dt className="analysis-flabel muted">Inputs</dt>
              <dd>{brief.inputs}</dd>
            </div>
            <div>
              <dt className="analysis-flabel muted">Outputs</dt>
              <dd>{brief.outputs}</dd>
            </div>
            <div>
              <dt className="analysis-flabel muted">Systems</dt>
              <dd>{brief.systems.join(", ")}</dd>
            </div>
            <div>
              <dt className="analysis-flabel muted">Recommended approach</dt>
              <dd>{brief.approach}</dd>
            </div>
            <div>
              <dt className="analysis-flabel muted">Effort estimate</dt>
              <dd>{brief.effortEstimate}</dd>
            </div>
            <div>
              <dt className="analysis-flabel muted">Estimated saving</dt>
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
            <button type="button" className="btn btn-merge" onClick={onGenerate}>
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
}
