import { useEffect, useState } from "react";
import type { MergedNode, Thumb } from "../../types";
import { getFeedback, setFeedback } from "../../lib/storage";

function meter(value: 1 | 2 | 3) {
  return (
    <span className="meter-bars">
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= value ? "meter-bar-on" : "meter-bar"} />
      ))}
    </span>
  );
}

export default function AnalysisPanel({
  node,
  inRegister,
  onAdd,
  onDismiss,
  onVote,
}: {
  node: MergedNode;
  inRegister: boolean;
  onAdd: () => void;
  onDismiss: () => void;
  onVote?: () => void;
}) {
  const [thumb, setThumb] = useState<Thumb | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFeedback().then((feedback) => {
      if (!cancelled) setThumb(feedback[node.id] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [node.id]);

  async function vote(value: Thumb) {
    setThumb(value);
    await setFeedback(node.id, value);
    onVote?.();
  }

  return (
    <div className="analysis-panel">
      <div className="analysis-eyebrow muted">Step analysis</div>
      <h2>{node.label}</h2>
      <p className="muted">
        {node.system} · {node.occurrence}/{node.totalSessions} sessions
        {node.isMainPath ? "" : node.isException ? " · exception" : " · variant"}
      </p>

      <div className="analysis-field">
        <div className="analysis-flabel muted">Step signature</div>
        <span className="sig-chip">{node.signature}</span>
      </div>

      <div className="analysis-field">
        <div className="analysis-flabel muted">Mapped intervention</div>
        <div>{node.intervention}</div>
      </div>

      <div className="analysis-field analysis-meters">
        <div>
          <div className="analysis-flabel muted">Effort</div>
          {meter(node.effort)}
        </div>
        <div>
          <div className="analysis-flabel muted">Impact</div>
          {meter(node.impact)}
        </div>
      </div>

      <div className="analysis-field">
        <div className="analysis-flabel muted">Estimated saving</div>
        <div>{node.estimatedSavingHrsPerMonth.toFixed(1)} hrs/month</div>
      </div>

      <div className="analysis-field">
        <div className="analysis-flabel muted">Recommendation</div>
        <p className="analysis-suggestion">{node.suggestionText}</p>
      </div>

      <div className="analysis-thumbs">
        <button
          type="button"
          className={`btn btn-thumb ${thumb === "up" ? "btn-thumb-active" : ""}`}
          onClick={() => vote("up")}
        >
          Useful
        </button>
        <button
          type="button"
          className={`btn btn-thumb ${thumb === "down" ? "btn-thumb-active" : ""}`}
          onClick={() => vote("down")}
        >
          Not useful
        </button>
      </div>

      <div className="analysis-actions">
        {inRegister ? (
          <button type="button" className="btn btn-discard" onClick={onDismiss}>
            Remove from register
          </button>
        ) : (
          <button type="button" className="btn btn-confirm" onClick={onAdd} disabled={!node.isOpportunity}>
            + Add to register
          </button>
        )}
      </div>
    </div>
  );
}
