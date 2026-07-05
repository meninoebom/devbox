import { Badge } from "~/components/ui/badge";

export interface PlanNode {
  id: number;
  node_type: string;
  relation: string | null;
  cost: number;
  plan_rows: number | null;
  actual_rows: number | null;
  loops: number | null;
  actual_ms: number | null;
  exclusive_ms: number | null;
  detail: string;
  misestimate_ratio: number;
  is_hot: boolean;
  is_misestimate: boolean;
  children: PlanNode[];
}

export interface Plan {
  root: PlanNode;
  planning_ms: number | null;
  execution_ms: number | null;
  worst_hot_id: number | null;
  worst_estimate_id: number | null;
}

function Node({ node, depth }: { node: PlanNode; depth: number }) {
  const scanColor = node.node_type.includes("Seq Scan")
    ? "text-rose-400"
    : node.node_type.includes("Index")
      ? "text-emerald-400"
      : "text-neutral-200";

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 16 }}>
      <div
        className={`rounded border px-3 py-2 mb-1.5 ${
          node.is_hot
            ? "border-amber-500/60 bg-amber-500/5"
            : "border-[#2a2a2a] bg-[#161616]"
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-mono text-sm font-semibold ${scanColor}`}>
            {node.node_type}
          </span>
          {node.detail && (
            <span className="font-mono text-xs text-neutral-500 truncate">
              {node.detail}
            </span>
          )}
          {node.is_hot && (
            <Badge
              variant="outline"
              className="text-[9px] uppercase tracking-wider text-amber-400 border-amber-700 ml-auto"
            >
              hottest
            </Badge>
          )}
          {node.is_misestimate && (
            <Badge
              variant="outline"
              className="text-[9px] uppercase tracking-wider text-rose-400 border-rose-700"
            >
              {node.misestimate_ratio}× off
            </Badge>
          )}
        </div>
        <div className="flex gap-4 mt-1.5 font-mono text-[11px] text-neutral-500 tabular-nums flex-wrap">
          <span>cost {Math.round(node.cost)}</span>
          <span>
            rows{" "}
            <span className="text-neutral-400">
              est {node.plan_rows ?? "?"} → act {node.actual_rows ?? "?"}
            </span>
          </span>
          {node.exclusive_ms != null && <span>self {node.exclusive_ms}ms</span>}
          {node.loops != null && node.loops > 1 && <span>×{node.loops} loops</span>}
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-[#2a2a2a] pl-2">
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanGraph({ plan }: { plan: Plan }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        <Node node={plan.root} depth={0} />
      </div>
    </div>
  );
}
