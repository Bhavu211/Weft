import type { PipelineColumn } from "../../lib/pipeline";

export default function AutomationPipeline({
  columns,
  onAdvance,
}: {
  columns: PipelineColumn[];
  onAdvance: (workflowId: string, stepId: string) => void;
}) {
  const isEmpty = columns.every((c) => c.opportunities.length === 0);

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Automation Pipeline</h2>
      {isEmpty ? (
        <p className="muted">
          No opportunities in the pipeline yet — add one to a workflow's register to see it move
          through review here.
        </p>
      ) : (
        <div className="pipeline-board">
          {columns.map((column) => (
            <div key={column.stage} className="pipeline-column">
              <div className="pipeline-column-header">
                <span>{column.label}</span>
                <span className="pipeline-column-count">{column.opportunities.length}</span>
              </div>
              <div className="pipeline-column-body">
                {column.opportunities.map((o) => (
                  <div key={`${o.workflowId}::${o.stepId}`} className="pipeline-card">
                    <div className="pipeline-card-name">{o.name}</div>
                    <div className="pipeline-card-workflow muted">{o.workflowId}</div>
                    {column.stage !== "sent_to_engineering" ? (
                      <button
                        type="button"
                        className="btn pipeline-advance-btn"
                        onClick={() => onAdvance(o.workflowId, o.stepId)}
                      >
                        Advance →
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
