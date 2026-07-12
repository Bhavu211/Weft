import { useMemo } from "react";
import ReactFlow, { Background, Controls, type Edge as RFEdge, type Node as RFNode } from "reactflow";
import "reactflow/dist/style.css";
import StepNode, { type StepNodeData } from "./StepNode";
import { layoutMergedNodes } from "../../lib/map-layout";
import type { MergeResult } from "../../types";

const nodeTypes = { step: StepNode };

export default function WorkflowMap({
  result,
  selectedNodeId,
  onSelectNode,
}: {
  result: MergeResult;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const positions = layoutMergedNodes(result.nodes);

    const rfNodes: RFNode<StepNodeData>[] = result.nodes.map((node) => ({
      id: node.id,
      type: "step",
      position: positions[node.id],
      data: { ...node, active: node.id === selectedNodeId },
    }));

    const rfEdges: RFEdge[] = result.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: `${edge.occurrence}/${edge.totalSessions}`,
      animated: edge.occurrence === edge.totalSessions,
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [result, selectedNodeId]);

  if (result.nodes.length === 0) {
    return <p className="muted">No reviewed sessions to merge yet.</p>;
  }

  return (
    <div className="workflow-map">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
