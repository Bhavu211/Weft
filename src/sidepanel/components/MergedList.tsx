import type { MergeResult } from "../../types";

// Plain-list rendering of a merge result for M4; the interactive React Flow
// graph (WorkflowMap/StepNode) with pan/zoom and click-to-analyze arrives in M5.
export default function MergedList({ result }: { result: MergeResult }) {
  if (result.nodes.length === 0) {
    return (
      <p className="muted">
        No reviewed sessions yet — record this workflow at least twice, confirm each in the
        privacy preview, then merge.
      </p>
    );
  }

  const alignmentFor = (nodeId: string) => result.alignments.find((a) => a.nodeId === nodeId);
  const sorted = [...result.nodes].sort((a, b) => a.order - b.order || Number(b.isMainPath) - Number(a.isMainPath));

  return (
    <div className="merged-list">
      <p className="muted">
        Merged {result.totalSessions} session{result.totalSessions === 1 ? "" : "s"}.
      </p>
      <ol className="step-list">
        {sorted.map((node) => {
          const alignment = alignmentFor(node.id);
          const kind = node.isMainPath ? "main path" : node.isException ? "exception" : "variant";
          return (
            <li key={node.id} className={`step-list-item merged-node-${kind.replace(" ", "-")}`}>
              <span className="step-list-order">{node.order + 1}.</span>
              <span className="step-list-label">
                {node.label} <span className="muted">· {kind}</span>
              </span>
              <span className="step-list-meta">
                {node.system} · {node.occurrence}/{node.totalSessions} sessions · {node.signature}
                {node.isOpportunity ? ` · ${node.intervention}` : ""}
              </span>
              {alignment ? (
                <details className="merge-alignment">
                  <summary className="muted">merged from {alignment.contributors.length} step(s)</summary>
                  <ul className="merge-alignment-list">
                    {alignment.contributors.map((c) => (
                      <li key={`${c.sessionId}-${c.stepId}`} className="muted">
                        session {c.sessionId}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
