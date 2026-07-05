import { useEffect, useState } from "react";
import { Dumbbell, Lock, Check, FlaskRound } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/lib/api";

export function meta() {
  return [
    { title: "The Gym - DevBox" },
    { name: "description", content: "Deliberate practice; benchmark what you build" },
  ];
}

const CACHE_SKELETON = `class Cache:
    def __init__(self, capacity):
        self.cap = capacity
        # your state here (OrderedDict is available)

    def get(self, key):
        ...  # return the value, or None

    def set(self, key, value):
        ...  # evict the least-recently-used when over capacity`;

interface Rep {
  id: number;
  phase: string;
  big_o: string | null;
  logged: boolean;
}
interface BenchRow {
  id: number;
  name: string;
  correct: boolean;
  hits: number | null;
  ref_hits: number | null;
  dust_days: number;
}

export default function Gym() {
  // rep flow
  const [topic, setTopic] = useState("");
  const [rep, setRep] = useState<Rep | null>(null);
  const [bigO, setBigO] = useState("");
  const [reflection, setReflection] = useState("");
  const [logMsg, setLogMsg] = useState<string | null>(null);

  // bench
  const [name, setName] = useState("my LRU");
  const [source, setSource] = useState(CACHE_SKELETON);
  const [benchResult, setBenchResult] = useState<any>(null);
  const [bench, setBench] = useState<BenchRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBench = async () => {
    try {
      const { data } = await api.bench.list();
      setBench(data);
    } catch {
      /* non-fatal */
    }
  };
  useEffect(() => {
    loadBench();
  }, []);

  const startRep = async () => {
    if (!topic.trim()) return;
    const { data } = await api.reps.create({ topic: topic.trim() });
    setRep(data);
    setBigO("");
    setReflection("");
    setLogMsg(null);
  };
  const commitPrediction = async () => {
    if (!rep || !bigO.trim()) return;
    const { data } = await api.reps.predict(rep.id, { big_o: bigO.trim() });
    setRep(data);
  };
  const reflectAndLog = async () => {
    if (!rep || !reflection.trim()) return;
    try {
      const { data } = await api.reps.reflect(rep.id, { reflection: reflection.trim() });
      setLogMsg(`Logged to ${data.log_path}`);
      setRep({ ...rep, phase: "done", logged: true });
    } catch (e: any) {
      setLogMsg(e?.detail || "reflect failed");
    }
  };

  const benchmark = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.bench.registerCache({ name, source });
      setBenchResult(data);
      if (data.registered) loadBench();
    } catch (e: any) {
      setBenchResult({ registered: false, error: e?.detail || "failed" });
    } finally {
      setLoading(false);
    }
  };

  const predicted = rep && rep.big_o;

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <Dumbbell size={20} className="text-amber-400" />
        <h1 className="text-2xl font-mono font-bold text-neutral-100">The Gym</h1>
      </div>
      <p className="text-neutral-500 text-sm mb-8 max-w-2xl">
        Deliberate practice against live software. Predict before you look; build
        primitives by hand and benchmark them against the library.
      </p>

      {/* A rep */}
      <section className="mb-12">
        <h2 className="text-xs uppercase tracking-widest text-neutral-600 font-mono mb-4">A rep</h2>
        {!rep ? (
          <div className="flex items-center gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startRep()}
              placeholder="Topic, e.g. windowed variance"
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50"
            />
            <Button onClick={startRep} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
              Start rep
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm font-mono text-neutral-300">
              <span className="text-neutral-500">topic:</span> {topic}
            </div>

            {/* predict phase */}
            <div className="rounded border border-[#2a2a2a] bg-[#161616] px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-amber-400 font-mono mb-2">
                1 · Predict (gated)
              </div>
              {!predicted ? (
                <div className="flex items-center gap-2">
                  <input
                    value={bigO}
                    onChange={(e) => setBigO(e.target.value)}
                    placeholder="Big-O, e.g. O(n)"
                    className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-1.5 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50"
                  />
                  <Button onClick={commitPrediction} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
                    Commit
                  </Button>
                </div>
              ) : (
                <div className="font-mono text-sm text-emerald-400 flex items-center gap-2">
                  <Check size={14} /> sealed: {rep.big_o}
                </div>
              )}
            </div>

            {/* reflect phase, locked until prediction committed */}
            <div className="rounded border border-[#2a2a2a] bg-[#161616] px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-2 flex items-center gap-1.5">
                {predicted ? "2 · Reflect & log" : (
                  <>
                    <Lock size={11} /> reflect (commit a prediction first)
                  </>
                )}
              </div>
              {predicted && !rep.logged && (
                <div className="space-y-2">
                  <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="One-sentence lesson for future you..."
                    rows={2}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50 resize-y"
                  />
                  <Button onClick={reflectAndLog} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
                    Reflect &amp; log
                  </Button>
                </div>
              )}
              {logMsg && <div className="font-mono text-xs text-emerald-400 mt-1">{logMsg}</div>}
            </div>

            <button onClick={() => setRep(null)} className="font-mono text-xs text-neutral-500 hover:text-neutral-300">
              new rep
            </button>
          </div>
        )}
      </section>

      {/* The Bench */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-neutral-600 font-mono mb-4">
          The Bench · cache_backend slot
        </h2>
        <p className="text-neutral-500 text-sm mb-3">
          Build an LRU cache by hand. It runs against a reference on the same workload;
          if your get-results match, you pass.
        </p>
        <div className="flex items-center gap-2 mb-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-1.5 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50"
          />
          <Button onClick={benchmark} disabled={loading} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
            <FlaskRound size={13} className="mr-1" /> Benchmark
          </Button>
        </div>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          rows={10}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-xs text-neutral-200 focus:outline-none focus:border-amber-500/50 resize-y mb-3"
        />

        {benchResult && (
          <div
            className={`rounded border px-4 py-3 mb-4 font-mono text-sm ${
              benchResult.registered && benchResult.correct
                ? "border-emerald-700/50 bg-emerald-500/5 text-emerald-400"
                : "border-rose-800/50 bg-rose-500/5 text-rose-300"
            }`}
          >
            {benchResult.error
              ? benchResult.error
              : benchResult.correct
                ? `passed · ${benchResult.hits} hits (reference: ${benchResult.ref_hits})`
                : `not matching the reference yet · ${benchResult.detail}`}
          </div>
        )}

        {bench.length > 0 && (
          <div className="space-y-1.5">
            {bench.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded border border-[#2a2a2a] bg-[#161616] px-3 py-2 font-mono text-xs"
                style={{ opacity: Math.max(0.4, 1 - b.dust_days * 0.1) }}
              >
                <Badge
                  variant="outline"
                  className={`text-[10px] ${b.correct ? "border-emerald-800 text-emerald-400" : "border-rose-800 text-rose-400"}`}
                >
                  {b.correct ? "passing" : "failing"}
                </Badge>
                <span className="text-neutral-300">{b.name}</span>
                <span className="text-neutral-600 ml-auto">
                  {b.dust_days === 0 ? "today" : `${b.dust_days}d dust`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
