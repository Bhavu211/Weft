import type { Opportunity } from "../../types";

export default function Register({
  opportunities,
  onRemove,
}: {
  opportunities: Opportunity[];
  onRemove: (stepId: string) => void;
}) {
  const totalSavingHrs = opportunities.reduce((sum, o) => sum + o.estimatedSavingHrs, 0);

  return (
    <div className="register">
      <div className="register-head">
        <span className="analysis-flabel muted">Opportunity register</span>
        <span className="muted register-count">
          {opportunities.length} logged · {totalSavingHrs.toFixed(1)} hrs/month
        </span>
      </div>
      {opportunities.length === 0 ? (
        <p className="muted">
          No opportunities logged yet. Walk the map, and add the steps worth pursuing.
        </p>
      ) : (
        <ol className="step-list">
          {opportunities.map((o) => (
            <li key={o.stepId} className="step-list-item register-item">
              <span className="step-list-label">{o.label}</span>
              <span className="step-list-meta">
                {o.intervention} · impact {o.impact}/3 · {o.estimatedSavingHrs.toFixed(1)} hrs/month · {o.status}
              </span>
              <button type="button" className="btn btn-discard register-remove" onClick={() => onRemove(o.stepId)}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
