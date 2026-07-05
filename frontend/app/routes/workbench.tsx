import { useState } from "react";
import { FlaskConical, Play, Server, ArrowRight, Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/lib/api";
import { useInspector } from "~/components/inspector/InspectorContext";
import { PlanGraph, type Plan, type PlanNode } from "~/components/workbench/PlanGraph";

export function meta() {
  return [
    { title: "Workbench - DevBox" },
    { name: "description", content: "Paste SQL, run it, see the plan" },
  ];
}

interface RunResult {
  specimen_up: boolean;
  error: string | null;
  columns?: string[];
  rows?: any[][];
  row_count?: number;
  truncated?: boolean;
  duration_ms?: number | null;
  plan?: Plan | null;
  trace_id?: number | null;
}

const STARTER_SQL = `SELECT id, title, price
FROM books
WHERE author_id = 42
ORDER BY price DESC`;

const SETUP_PLACEHOLDER = `-- Setup DDL runs before your query, and persists.
-- Try adding an index, then run again and watch the plan change:
-- CREATE INDEX idx_books_author ON books(author_id);`;

function findNode(node: PlanNode | undefined, id: number | null): PlanNode | null {
  if (!node || id == null) return null;
  if (node.id === id) return node;
  for (const c of node.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

function headlineNode(plan: Plan | null | undefined): string | null {
  if (!plan) return null;
  return findNode(plan.root, plan.worst_hot_id)?.node_type ?? plan.root.node_type;
}

function DiffStrip({ prev, curr }: { prev: RunResult; curr: RunResult }) {
  const pMs = prev.duration_ms ?? 0;
  const cMs = curr.duration_ms ?? 0;
  const faster = cMs < pMs;
  const factor = cMs > 0 ? pMs / cMs : 0;
  const prevNode = headlineNode(prev.plan);
  const currNode = headlineNode(curr.plan);
  const nodeChanged = prevNode !== currNode;

  return (
    <div className="rounded border border-[#2a2a2a] bg-[#141414] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-neutral-500 font-mono">
        vs previous
      </span>
      <span className="font-mono text-neutral-300 flex items-center gap-2 tabular-nums">
        {pMs}ms <ArrowRight size={12} className="text-neutral-600" /> {cMs}ms
        <span className={faster ? "text-emerald-400" : "text-rose-400"}>
          {faster && factor >= 1.1
            ? `${factor.toFixed(1)}× faster`
            : cMs > pMs
              ? "slower"
              : "~same"}
        </span>
      </span>
      {nodeChanged && (
        <span className="font-mono text-neutral-300 flex items-center gap-2">
          <span className="text-rose-400">{prevNode}</span>
          <ArrowRight size={12} className="text-neutral-600" />
          <span className="text-emerald-400">{currNode}</span>
        </span>
      )}
    </div>
  );
}

function SpecimenDown({ error }: { error: string | null }) {
  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-500/5 px-6 py-6">
      <div className="flex items-center gap-2 mb-3">
        <Server size={18} className="text-amber-400" />
        <h3 className="font-mono text-sm text-amber-300">Lab specimen is not running</h3>
      </div>
      <p className="text-neutral-400 text-sm mb-4">
        {error || "The Workbench runs your SQL against a disposable Postgres lab."}{" "}
        Start it, then run again. Nothing else in DevBox needs it.
      </p>
      <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-4 py-3 font-mono text-sm text-emerald-400 overflow-x-auto">
        mise run lab:up
      </pre>
    </div>
  );
}

function ResultGrid({ result }: { result: RunResult }) {
  const cols = result.columns ?? [];
  const rows = result.rows ?? [];
  if (cols.length === 0) return <p className="text-neutral-500 text-sm">No rows returned.</p>;
  return (
    <div className="overflow-x-auto border border-[#2a2a2a] rounded">
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="border-b border-[#2a2a2a] bg-[#161616]">
            {cols.map((c) => (
              <th key={c} className="text-left px-3 py-2 text-amber-400 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1e1e1e]">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-neutral-300 whitespace-nowrap tabular-nums">
                  {cell === null ? <span className="text-neutral-600">null</span> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Workbench() {
  const { inspectTrace } = useInspector();
  const [setupSql, setSetupSql] = useState("");
  const [sql, setSql] = useState(STARTER_SQL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [prev, setPrev] = useState<RunResult | null>(null);

  const runQuery = async () => {
    if (!sql.trim() || loading) return;
    setLoading(true);
    try {
      const { data } = await api.workbench.run({
        sql,
        setup_sql: setupSql.trim() || undefined,
      });
      // Stash the last good run so we can diff against it.
      if (result && result.specimen_up && !result.error) setPrev(result);
      else setPrev(null);
      setResult(data);
    } catch (e: any) {
      setResult({ specimen_up: true, error: e?.detail || e?.message || String(e) });
      setPrev(null);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runQuery();
    }
  };

  const good = result && result.specimen_up && !result.error;

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <FlaskConical size={20} className="text-amber-400" />
        <h1 className="text-2xl font-mono font-bold text-neutral-100">Workbench</h1>
      </div>
      <p className="text-neutral-500 text-sm mb-6 max-w-2xl">
        Run a query against the lab database and read its plan. Add an index in the
        setup pane, run again, and watch the plan change.
      </p>

      {/* Editors */}
      <div className="space-y-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5 block">
            Setup (runs first, persists)
          </label>
          <textarea
            value={setupSql}
            onChange={(e) => setSetupSql(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={SETUP_PLACEHOLDER}
            spellCheck={false}
            rows={3}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 resize-y"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5 block">
            Query
          </label>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            rows={5}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50 resize-y"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={runQuery}
            disabled={loading}
            className="bg-amber-500 text-black hover:bg-amber-400 font-mono"
          >
            <Play size={14} className="mr-1.5" />
            {loading ? "Running..." : "Run"}
          </Button>
          <span className="text-[11px] text-neutral-600 font-mono">⌘/Ctrl + Enter</span>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 space-y-4">
        {result && !result.specimen_up && <SpecimenDown error={result.error} />}

        {result && result.specimen_up && result.error && (
          <div className="rounded border border-rose-700/50 bg-rose-500/5 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-rose-400 font-mono mb-1.5">
              SQL error
            </div>
            <pre className="font-mono text-sm text-rose-300 whitespace-pre-wrap">
              {result.error}
            </pre>
          </div>
        )}

        {good && (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-sm">
              <span className="text-neutral-300 tabular-nums">
                <span className="text-amber-400">{result!.duration_ms}</span> ms exec
              </span>
              {result!.plan?.planning_ms != null && (
                <span className="text-neutral-500 tabular-nums">
                  {result!.plan.planning_ms} ms planning
                </span>
              )}
              <span className="text-neutral-500 tabular-nums">
                {result!.row_count} rows{result!.truncated ? " (capped)" : ""}
              </span>
              {result!.trace_id != null && (
                <button
                  onClick={() => inspectTrace(String(result!.trace_id))}
                  className="ml-auto flex items-center gap-1.5 text-neutral-500 hover:text-amber-400 text-xs"
                >
                  <Search size={12} /> Inspect trace #{result!.trace_id}
                </button>
              )}
            </div>

            {prev && good && <DiffStrip prev={prev} curr={result!} />}

            {result!.plan && (
              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-2">
                  Query plan
                </h3>
                <PlanGraph plan={result!.plan} />
              </div>
            )}

            <div>
              <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-2">
                Rows
              </h3>
              <ResultGrid result={result!} />
            </div>
          </>
        )}

        {!result && (
          <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#141414] px-6 py-8 text-center">
            <Badge
              variant="outline"
              className="text-[10px] border-[#2a2a2a] text-neutral-500 font-mono mb-2"
            >
              ready
            </Badge>
            <p className="text-neutral-500 text-sm">
              Run the starter query to see its plan, then add an index in setup and
              run again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
