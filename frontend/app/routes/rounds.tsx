import { useEffect, useState } from "react";
import { Swords, Play, RefreshCw, Trophy } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/lib/api";
import { PlanGraph, type Plan } from "~/components/workbench/PlanGraph";

export function meta() {
  return [
    { title: "The Rounds - DevBox" },
    { name: "description", content: "Generated puzzles, scored by par" },
  ];
}

interface Round {
  id: number;
  family: string;
  fmt: string;
  description: string;
  baseline_query: string;
  target_ms: number | null;
  symptom: { specimen_up: boolean; error: string | null; exec_ms: number | null; plan: Plan | null };
}

interface SubmitResult {
  specimen_up?: boolean;
  won?: boolean;
  error?: string | null;
  win_detail?: string;
  changes?: number;
  par_changes?: number;
  delta?: number;
  exec_ms?: number | null;
  target_ms?: number | null;
  rows?: number;
  plan?: Plan | null;
  best_changes?: number | null;
  par_note?: string | null;
}

export default function Rounds() {
  const [fmt, setFmt] = useState<"regression" | "target">("regression");
  const [round, setRound] = useState<Round | null>(null);
  const [fixSql, setFixSql] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cadence, setCadence] = useState<{ reps: number; cadence_14d: number } | null>(null);

  const loadCadence = async () => {
    try {
      const { data } = await api.rounds.cadence();
      setCadence(data);
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    loadCadence();
  }, []);

  const deal = async () => {
    setLoading(true);
    setResult(null);
    setFixSql("");
    try {
      const { data } = await api.rounds.generate({ fmt });
      setRound(data);
    } catch (e: any) {
      setRound(null);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!round || !fixSql.trim() || loading) return;
    setLoading(true);
    try {
      const { data } = await api.rounds.submit(round.id, { fix_sql: fixSql });
      setResult(data);
      if (data.won) loadCadence();
    } catch (e: any) {
      setResult({ error: e?.detail || "submit failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <Swords size={20} className="text-amber-400" />
          <h1 className="text-2xl font-mono font-bold text-neutral-100">The Rounds</h1>
        </div>
        {cadence && (
          <div className="font-mono text-xs text-neutral-500 flex items-center gap-4 tabular-nums">
            <span>
              <span className="text-amber-400">{cadence.reps}</span> reps
            </span>
            <span>
              <span className="text-neutral-300">{cadence.cadence_14d}</span> in 14d
            </span>
          </div>
        )}
      </div>
      <p className="text-neutral-500 text-sm mb-6 max-w-2xl">
        A generated fault, a symptom, a win check. Fix it in as few changes as you can:
        you are scored against par, not points.
      </p>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="inline-flex border border-[#2a2a2a] rounded overflow-hidden">
          {(["regression", "target"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFmt(f)}
              className={`font-mono text-xs px-3 py-1.5 ${
                fmt === f ? "bg-neutral-700 text-amber-300" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Button
          onClick={deal}
          disabled={loading}
          className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs"
        >
          <RefreshCw size={13} className="mr-1.5" />
          {round ? "Deal another" : "Deal a round"}
        </Button>
      </div>

      {!round && (
        <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#141414] px-6 py-10 text-center text-neutral-500 text-sm">
          Deal a round to begin.
        </div>
      )}

      {round && !round.symptom.specimen_up && (
        <div className="rounded border border-amber-700/40 bg-amber-500/5 px-4 py-3 text-sm text-neutral-300">
          The lab specimen is not running. Start it with{" "}
          <code className="font-mono text-emerald-400">mise run lab:up</code>.
        </div>
      )}

      {round && round.symptom.specimen_up && (
        <div className="space-y-5">
          <div className="rounded border border-[#2a2a2a] bg-[#161616] px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className="text-[10px] font-mono border-rose-800 text-rose-400 uppercase">
                {round.family.replace("_", " ")}
              </Badge>
              <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider">
                {round.fmt}
              </span>
              {round.target_ms != null && (
                <span className="text-[11px] font-mono text-amber-400 ml-auto tabular-nums">
                  goal: &lt; {round.target_ms} ms
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-300">{round.description}</p>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5">
              Symptom query{" "}
              <span className="text-neutral-600">· {round.symptom.exec_ms} ms</span>
            </h3>
            <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-xs text-neutral-300 overflow-x-auto mb-3">
              {round.baseline_query}
            </pre>
            {round.symptom.plan && <PlanGraph plan={round.symptom.plan} />}
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-1.5 block">
              Your fix (DDL runs before the query re-runs)
            </label>
            <textarea
              value={fixSql}
              onChange={(e) => setFixSql(e.target.value)}
              placeholder="CREATE INDEX ..."
              spellCheck={false}
              rows={3}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 resize-y"
            />
            <Button
              onClick={submit}
              disabled={loading}
              className="mt-2 bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs"
            >
              <Play size={13} className="mr-1.5" /> Submit fix
            </Button>
          </div>

          {result && (
            <div
              className={`rounded border px-4 py-3 ${
                result.won
                  ? "border-emerald-700/50 bg-emerald-500/5"
                  : "border-rose-800/50 bg-rose-500/5"
              }`}
            >
              {result.error ? (
                <pre className="font-mono text-sm text-rose-300 whitespace-pre-wrap">{result.error}</pre>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    {result.won ? (
                      <Trophy size={15} className="text-emerald-400" />
                    ) : null}
                    <span
                      className={`font-mono text-sm font-semibold ${
                        result.won ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {result.won ? "Solved" : "Not yet"}
                    </span>
                    <span className="font-mono text-xs text-neutral-400 tabular-nums ml-auto">
                      {result.changes} change{result.changes === 1 ? "" : "s"} · par {result.par_changes}
                      {result.delta === 0 ? " · at par" : result.delta! > 0 ? ` · +${result.delta} over` : ""}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-neutral-500">
                    {result.exec_ms} ms
                    {result.target_ms != null ? ` · goal < ${result.target_ms} ms` : ""}
                  </div>
                  {result.par_note && (
                    <div className="mt-2 font-mono text-xs text-emerald-400/80">
                      par fix: {result.par_note}
                    </div>
                  )}
                  {result.plan && (
                    <div className="mt-3">
                      <PlanGraph plan={result.plan} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
