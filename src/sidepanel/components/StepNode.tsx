import { Handle, Position } from "reactflow";
import type { MergedNode } from "../../types";

export type StepNodeData = MergedNode & { active: boolean };

function stateClass(data: StepNodeData): string {
  if (data.isException) return "step-node-exception";
  if (data.isBottleneck) return "step-node-bottleneck";
  if (data.isOpportunity) return "step-node-opportunity";
  return "step-node-normal";
}

export default function StepNode({ data }: { data: StepNodeData }) {
  return (
    <div className={`step-node ${stateClass(data)} ${data.active ? "step-node-active" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="step-node-label">{data.label}</div>
      <div className="step-node-meta">
        {data.occurrence}/{data.totalSessions} · {data.signature}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
