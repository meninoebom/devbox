import { useState } from "react";
import { Bot, Search, Crosshair, Scissors } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/lib/api";

export function meta() {
  return [
    { title: "The Agent Floor - DevBox" },
    { name: "description", content: "Generated agent puzzles: attribution, tripwire, ablation" },
  ];
}

const STAGE_ORDER = ["db", "sql", "retrieval", "context", "answer"];
const ABLATION_FIELDS = ["A", "B", "C", "D", "E"];

export default function Agent() {
  // Attribution
  const [stages, setStages] = useState<any[] | null>(null);
  const [guess, setGuess] = useState<string | null>(null);
  const [attrResult, setAttrResult] = useState<any>(null);

  const dealAttribution = async () => {
    const { data } = await api.agent.attribution();
    setStages(data.stages);
    setGuess(null);
    setAttrResult(null);
  };
  const submitAttribution = async () => {
    if (!stages || !guess) return;
    const { data } = await api.agent.attributionCheck({ stages, layer: guess });
    setAttrResult(data);
  };

  // Retrieval miss
  const [retr, setRetr] = useState<{ ok: any; miss: any } | null>(null);
  const runRetrieval = async () => {
    const [ok, miss] = await Promise.all([
      api.agent.retrievalDemo(false),
      api.agent.retrievalDemo(true),
    ]);
    setRetr({ ok: ok.data, miss: miss.data });
  };

  // Ablation
  const [fields, setFields] = useState<string[]>(["A", "B", "C"]);
  const [ablResult, setAblResult] = useState<any>(null);
  const toggleField = (f: string) =>
    setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const checkAblation = async () => {
    const { data } = await api.agent.ablationCheck({ config_fields: fields });
    setAblResult(data);
  };

  // Tripwire
  const [twValue, setTwValue] = useState("100");
  const [twResult, setTwResult] = useState<any>(null);
  const attemptTripwire = async () => {
    const { data } = await api.agent.tripwireAttempt({
      assertion: { target: "tokens", op: "lte", value: Number(twValue) },
    });
    setTwResult(data);
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <Bot size={20} className="text-amber-400" />
        <h1 className="text-2xl font-mono font-bold text-neutral-100">The Agent Floor</h1>
      </div>
      <p className="text-neutral-500 text-sm mb-8 max-w-2xl">
        Generated agent puzzles. Every verdict runs through the same assertion engine
        the whole app uses; the formats are deterministic, so no key is needed to play.
      </p>

      {/* Attribution */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Crosshair size={15} className="text-amber-400" />
          <h2 className="text-sm font-mono font-semibold text-neutral-200">Attribution</h2>
          <span className="text-xs text-neutral-500">a datum went missing — which layer ate it?</span>
        </div>
        <Button onClick={dealAttribution} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs mb-3">
          Deal an instance
        </Button>
        {stages && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
              {stages.map((s) => (
                <div
                  key={s.stage}
                  className={`px-2 py-1 rounded border ${
                    s.gold_present ? "border-emerald-800 text-emerald-400" : "border-rose-800 text-rose-400"
                  }`}
                >
                  {s.stage}: {s.gold_present ? "present" : "gone"}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono">guilty layer:</span>
              {STAGE_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => setGuess(s)}
                  className={`font-mono text-[11px] px-2 py-1 border rounded ${
                    guess === s ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-[#2a2a2a] text-neutral-500"
                  }`}
                >
                  {s}
                </button>
              ))}
              <Button onClick={submitAttribution} disabled={!guess} className="bg-neutral-700 text-amber-300 hover:bg-neutral-600 font-mono text-xs">
                Accuse
              </Button>
            </div>
            {attrResult && (
              <div className={`font-mono text-sm ${attrResult.correct ? "text-emerald-400" : "text-rose-400"}`}>
                {attrResult.correct ? "correct" : `no — it was ${attrResult.fault_layer}`}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Retrieval miss */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Search size={15} className="text-amber-400" />
          <h2 className="text-sm font-mono font-semibold text-neutral-200">Retrieval miss</h2>
          <span className="text-xs text-neutral-500">shrink top-k below the gold chunk's rank (sqlite-vec)</span>
        </div>
        <Button onClick={runRetrieval} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs mb-3">
          Run both
        </Button>
        {retr && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            {[["full k", retr.ok], ["miss (k too small)", retr.miss]].map(([label, r]: any) => (
              <div key={label} className="rounded border border-[#2a2a2a] bg-[#161616] px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-neutral-500">{label}</span>
                  <Badge variant="outline" className={`text-[10px] ${r.found ? "border-emerald-800 text-emerald-400" : "border-rose-800 text-rose-400"}`}>
                    gold {r.found ? "found" : "missed"}
                  </Badge>
                </div>
                <div className="text-neutral-500">k={r.k} · {r.hits.length} hits</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ablation */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Scissors size={15} className="text-amber-400" />
          <h2 className="text-sm font-mono font-semibold text-neutral-200">Ablation</h2>
          <span className="text-xs text-neutral-500">cut context fields; a held-out eval punishes overfitting</span>
        </div>
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {ABLATION_FIELDS.map((f) => (
            <button
              key={f}
              onClick={() => toggleField(f)}
              className={`font-mono text-xs px-2.5 py-1 border rounded ${
                fields.includes(f) ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-[#2a2a2a] text-neutral-600"
              }`}
            >
              {f}
            </button>
          ))}
          <Button onClick={checkAblation} className="bg-neutral-700 text-amber-300 hover:bg-neutral-600 font-mono text-xs">
            Check
          </Button>
        </div>
        {ablResult && (
          <div className={`font-mono text-sm ${ablResult.accepted ? "text-emerald-400" : "text-rose-400"}`}>
            {ablResult.reason} · {ablResult.tokens} fields
          </div>
        )}
      </section>

      {/* Tripwire */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Crosshair size={15} className="text-amber-400" />
          <h2 className="text-sm font-mono font-semibold text-neutral-200">Tripwire</h2>
          <span className="text-xs text-neutral-500">author the check that catches the fault, scored on held-out</span>
        </div>
        <div className="flex items-center gap-2 mb-2 font-mono text-xs">
          <span className="text-neutral-400">good if tokens ≤</span>
          <input
            value={twValue}
            onChange={(e) => setTwValue(e.target.value)}
            className="w-20 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-neutral-200 focus:outline-none focus:border-amber-500/50"
          />
          <Button onClick={attemptTripwire} className="bg-neutral-700 text-amber-300 hover:bg-neutral-600 font-mono text-xs">
            Score on held-out
          </Button>
        </div>
        {twResult && (
          <div className="font-mono text-sm text-neutral-300 tabular-nums">
            held-out precision{" "}
            <span className={twResult.holdout.precision === 1 ? "text-emerald-400" : "text-rose-400"}>
              {twResult.holdout.precision}
            </span>{" "}
            · recall{" "}
            <span className={twResult.holdout.recall === 1 ? "text-emerald-400" : "text-rose-400"}>
              {twResult.holdout.recall}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
