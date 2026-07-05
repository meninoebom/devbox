import { useState } from "react";
import { Wrench, Send, Lightbulb, StepForward, Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/lib/api";
import { useInspector } from "~/components/inspector/InspectorContext";

export function meta() {
  return [
    { title: "The Mechanic - DevBox" },
    { name: "description", content: "Ask the resident agent; watch it think" },
  ];
}

type Turn = { role: "you" | "mechanic" | "hint" | "note"; text: string; traceId?: number | null };
type StepRow = { kind: string; correct: boolean | null; detail: string };

const HINT_LABELS = ["lane", "question", "narrow", "method"];

export default function Mechanic() {
  const { inspectTrace } = useInspector();
  const [mode, setMode] = useState<"chat" | "step">("chat");
  const [stance, setStance] = useState<"workbench" | "training">("workbench");
  const [input, setInput] = useState("Why is the messages page slow?");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  // step mode
  const [stepMessages, setStepMessages] = useState<any[] | null>(null);
  const [stepLog, setStepLog] = useState<StepRow[]>([]);
  const [predict, setPredict] = useState<"tool" | "answer">("tool");
  const [stepDone, setStepDone] = useState(false);

  const lastQuestion = () => [...turns].reverse().find((t) => t.role === "you")?.text || input;

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setTurns((t) => [...t, { role: "you", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.mechanic.ask({ question: q, stance });
      setTurns((t) => [
        ...t,
        { role: "mechanic", text: data.answer, traceId: data.trace_id },
      ]);
    } catch (e: any) {
      setTurns((t) => [
        ...t,
        { role: "note", text: e?.detail || e?.message || "Something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getHint = async (tier: number) => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.mechanic.hint({ question: lastQuestion(), tier });
      setTurns((t) => [...t, { role: "hint", text: `Tier ${tier}: ${data.hint}` }]);
    } catch (e: any) {
      setTurns((t) => [...t, { role: "note", text: e?.detail || "Hint failed." }]);
    } finally {
      setLoading(false);
    }
  };

  const startStep = () => {
    setStepMessages([{ role: "user", content: input.trim() || lastQuestion() }]);
    setStepLog([]);
    setStepDone(false);
  };

  const step = async () => {
    if (!stepMessages || loading || stepDone) return;
    setLoading(true);
    try {
      const { data } = await api.mechanic.step({ messages: stepMessages, stance, predict });
      const detail =
        data.kind === "tool_use"
          ? `tool_use → ${(data.tools || []).join(", ")}`
          : `answer: ${data.answer}`;
      setStepLog((l) => [...l, { kind: data.kind, correct: data.correct, detail }]);
      setStepMessages(data.messages);
      setStepDone(data.done);
    } catch (e: any) {
      setStepLog((l) => [...l, { kind: "error", correct: null, detail: e?.detail || "step failed" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <Wrench size={20} className="text-amber-400" />
        <h1 className="text-2xl font-mono font-bold text-neutral-100">The Mechanic</h1>
      </div>
      <p className="text-neutral-500 text-sm mb-6 max-w-2xl">
        The resident engineer. Its tools are DevBox's own API, so its work shows up in
        the Inspector. Direct at the Workbench; in a training surface it makes you
        commit a prediction first.
      </p>

      {/* mode + stance toggles */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="inline-flex border border-[#2a2a2a] rounded overflow-hidden">
          {(["chat", "step"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`font-mono text-xs px-3 py-1.5 ${
                mode === m ? "bg-amber-500 text-black" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {m === "chat" ? "chat" : "specimen (step)"}
            </button>
          ))}
        </div>
        <div className="inline-flex border border-[#2a2a2a] rounded overflow-hidden">
          {(["workbench", "training"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStance(s)}
              className={`font-mono text-xs px-3 py-1.5 ${
                stance === s ? "bg-neutral-700 text-amber-300" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {mode === "chat" ? (
        <>
          <div className="space-y-3 mb-4 min-h-[120px]">
            {turns.length === 0 && (
              <p className="text-neutral-600 text-sm font-mono">
                Ask a question. Try the training stance to see the prediction gate.
              </p>
            )}
            {turns.map((t, i) => (
              <div
                key={i}
                className={`rounded border px-4 py-3 ${
                  t.role === "you"
                    ? "border-[#2a2a2a] bg-[#161616]"
                    : t.role === "hint"
                      ? "border-sky-800/60 bg-sky-500/5"
                      : t.role === "note"
                        ? "border-rose-800/60 bg-rose-500/5"
                        : "border-amber-800/40 bg-amber-500/5"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono mb-1 flex items-center gap-2">
                  {t.role}
                  {t.traceId != null && (
                    <button
                      onClick={() => inspectTrace(String(t.traceId))}
                      className="flex items-center gap-1 text-neutral-500 hover:text-amber-400"
                    >
                      <Search size={11} /> trace #{t.traceId}
                    </button>
                  )}
                </div>
                <div className="text-sm text-neutral-200 whitespace-pre-wrap">{t.text}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask the Mechanic..."
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50"
            />
            <Button
              onClick={send}
              disabled={loading}
              className="bg-amber-500 text-black hover:bg-amber-400 font-mono"
            >
              <Send size={14} />
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-neutral-600 font-mono flex items-center gap-1">
              <Lightbulb size={12} /> stuck? hint
            </span>
            {HINT_LABELS.map((label, tier) => (
              <button
                key={tier}
                onClick={() => getHint(tier)}
                disabled={loading}
                className="font-mono text-[11px] px-2 py-1 border border-[#2a2a2a] rounded text-neutral-500 hover:text-sky-400 hover:border-sky-800"
              >
                {tier}: {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div>
          <p className="text-neutral-500 text-sm mb-3">
            Run the loop one turn at a time. Call each step before you take it: will the
            model reach for a tool, or answer? The messages array grows below and is what
            you would edit to steer it.
          </p>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Button
              onClick={startStep}
              className="bg-neutral-700 text-amber-300 hover:bg-neutral-600 font-mono text-xs"
            >
              Reset with current question
            </Button>
            <span className="text-[11px] uppercase tracking-wider text-neutral-600 font-mono">call:</span>
            {(["tool", "answer"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPredict(p)}
                className={`font-mono text-[11px] px-2 py-1 border rounded ${
                  predict === p
                    ? "border-amber-500 text-amber-400 bg-amber-500/10"
                    : "border-[#2a2a2a] text-neutral-500"
                }`}
              >
                {p}
              </button>
            ))}
            <Button
              onClick={step}
              disabled={loading || !stepMessages || stepDone}
              className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs"
            >
              <StepForward size={13} className="mr-1" /> Step
            </Button>
            {stepDone && (
              <Badge variant="outline" className="text-[10px] border-emerald-800 text-emerald-400 font-mono">
                loop exited
              </Badge>
            )}
          </div>

          <div className="space-y-2 mb-5">
            {stepLog.map((s, i) => (
              <div key={i} className="rounded border border-[#2a2a2a] bg-[#161616] px-3 py-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">step {i + 1}</span>
                  <span className={s.kind === "answer" ? "text-amber-400" : "text-sky-400"}>{s.kind}</span>
                  {s.correct !== null && (
                    <span className={s.correct ? "text-emerald-400" : "text-rose-400"}>
                      call {s.correct ? "right" : "wrong"}
                    </span>
                  )}
                </div>
                <div className="text-neutral-300 mt-1 whitespace-pre-wrap">{s.detail}</div>
              </div>
            ))}
          </div>

          {stepMessages && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-2">
                messages array ({stepMessages.length})
              </h3>
              <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-[11px] text-neutral-400 overflow-x-auto max-h-64">
                {JSON.stringify(stepMessages, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
