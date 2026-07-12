import type { ClassifiedStep } from "../../types";

// Plain-list rendering for M2; the React Flow graph (WorkflowMap/StepNode) arrives in M5.
export default function StepList({ steps }: { steps: ClassifiedStep[] }) {
  if (steps.length === 0) {
    return <p className="muted">Nothing recorded yet — name a workflow above and hit Start.</p>;
  }

  return (
    <ol className="step-list">
      {steps.map((step) => (
        <li key={step.id} className="step-list-item">
          <span className="step-list-order">{step.order + 1}.</span>
          <span className="step-list-label">{step.label}</span>
          <span className="step-list-meta">
            {step.domain}
            {step.urlPath} · {step.events.length} event{step.events.length === 1 ? "" : "s"} · {step.signature} ·{" "}
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        </li>
      ))}
    </ol>
  );
}
