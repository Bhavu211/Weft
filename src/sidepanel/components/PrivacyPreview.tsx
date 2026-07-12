import { useState } from "react";
import type { ClassifiedStep } from "../../types";
import { buildPrivacyPreview, REDACTED_LABEL } from "../../lib/privacy-preview";

export default function PrivacyPreview({
  steps,
  onConfirm,
  onDiscard,
}: {
  steps: ClassifiedStep[];
  onConfirm: (labelEdits: Record<string, string>) => void;
  onDiscard: () => void;
}) {
  const previewSteps = buildPrivacyPreview(steps);
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(previewSteps.map((s) => [s.id, s.label]))
  );

  function setLabel(id: string, value: string) {
    setLabels((prev) => ({ ...prev, [id]: value }));
  }

  function confirm() {
    const edits: Record<string, string> = {};
    for (const step of previewSteps) {
      if (labels[step.id] !== step.label) edits[step.id] = labels[step.id];
    }
    onConfirm(edits);
  }

  return (
    <div className="privacy-preview">
      <h2>Before this is saved</h2>
      <p className="muted">
        No input values, query strings, page content, or screenshots were captured — only
        the step labels, systems, and timings below. Edit or redact any label you'd rather
        not keep, or discard the whole session.
      </p>
      <ol className="privacy-preview-list">
        {previewSteps.map((step) => (
          <li key={step.id} className="privacy-preview-item">
            <span className="step-list-order">{step.order + 1}.</span>
            <input
              className="privacy-preview-label"
              value={labels[step.id]}
              onChange={(e) => setLabel(step.id, e.target.value)}
              aria-label={`Label for step ${step.order + 1}`}
            />
            <button type="button" className="btn btn-redact" onClick={() => setLabel(step.id, REDACTED_LABEL)}>
              Redact
            </button>
            <span className="step-list-meta">
              {step.system} · {(step.durationMs / 1000).toFixed(1)}s
            </span>
          </li>
        ))}
      </ol>
      <div className="privacy-preview-actions">
        <button type="button" className="btn btn-discard" onClick={onDiscard}>
          Discard session
        </button>
        <button type="button" className="btn btn-confirm" onClick={confirm}>
          Save session
        </button>
      </div>
    </div>
  );
}
