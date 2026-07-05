import { useState } from "react";
import { FolderOpen, ArrowRight, Check, Lock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { api } from "~/lib/api";
import { PlanGraph, type Plan } from "~/components/workbench/PlanGraph";

export function meta() {
  return [
    { title: "Case Files - DevBox" },
    { name: "description", content: "Work a real question across two worlds" },
  ];
}

interface CaseView {
  id: number;
  title: string;
  status: string;
  template_1: string;
  template_2: string | null;
  context1_solved: boolean;
  context2_solved: boolean;
}
interface Symptom {
  plan: Plan | null;
  exec_ms?: number | null;
}

export default function Cases() {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [kase, setKase] = useState<CaseView | null>(null);
  const [symptom1, setSymptom1] = useState<Symptom | null>(null);
  const [symptom2, setSymptom2] = useState<Symptom | null>(null);
  const [note, setNote] = useState("");
  const [fixSql, setFixSql] = useState("");
  const [portResult, setPortResult] = useState<any>(null);
  const [explain, setExplain] = useState("");
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(false);

  const file = async () => {
    if (!title.trim() || !question.trim() || loading) return;
    setLoading(true);
    try {
      const { data } = await api.cases.create({ title: title.trim(), question: question.trim() });
      setKase(data.case);
      setSymptom1(data.symptom);
    } finally {
      setLoading(false);
    }
  };

  const advance = async () => {
    if (!kase || !note.trim() || loading) return;
    setLoading(true);
    try {
      const { data } = await api.cases.advance(kase.id, { note: note.trim() });
      setKase(data.case);
      setSymptom2(data.symptom);
    } finally {
      setLoading(false);
    }
  };

  const port = async () => {
    if (!kase || !fixSql.trim() || loading) return;
    setLoading(true);
    try {
      const { data } = await api.cases.port(kase.id, { fix_sql: fixSql.trim() });
      setPortResult(data);
      if (data.ported) setKase({ ...kase, context2_solved: true });
    } finally {
      setLoading(false);
    }
  };

  const close = async () => {
    if (!kase || !explain.trim() || loading) return;
    setLoading(true);
    try {
      await api.cases.close(kase.id, { explain_back: explain.trim() });
      setClosed(true);
    } catch (e: any) {
      setPortResult({ error: e?.detail });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <FolderOpen size={20} className="text-amber-400" />
        <h1 className="text-2xl font-mono font-bold text-neutral-100">Case Files</h1>
      </div>
      <p className="text-neutral-500 text-sm mb-8 max-w-2xl">
        A real question, worked in a seeded world. Then the two-context rule: the same
        principle re-seeded in a different world, where you port the fix. You cannot
        close until you have carried it across.
      </p>

      {!kase ? (
        <div className="space-y-2 max-w-xl">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. KV cache for the murmuration reads?"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50"
          />
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="The question you actually have..."
            rows={3}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50 resize-y"
          />
          <Button onClick={file} disabled={loading} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
            File it
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* progress */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Badge variant="outline" className={`text-[10px] ${kase.context1_solved ? "border-emerald-800 text-emerald-400" : "border-amber-800 text-amber-400"}`}>
              1 · {kase.template_1}
            </Badge>
            <ArrowRight size={12} className="text-neutral-600" />
            <Badge variant="outline" className={`text-[10px] ${kase.context2_solved ? "border-emerald-800 text-emerald-400" : kase.template_2 ? "border-amber-800 text-amber-400" : "border-[#2a2a2a] text-neutral-600"}`}>
              2 · {kase.template_2 || "?"}
            </Badge>
            <ArrowRight size={12} className="text-neutral-600" />
            <Badge variant="outline" className={`text-[10px] ${closed ? "border-emerald-800 text-emerald-400" : "border-[#2a2a2a] text-neutral-600"}`}>
              closed
            </Badge>
          </div>

          {/* world 1 */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-amber-400 font-mono mb-2">
              World 1 · {kase.template_1} — the symptom
            </h3>
            {symptom1?.plan && <PlanGraph plan={symptom1.plan} />}
            {!kase.context1_solved && (
              <div className="mt-3 space-y-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you find? (then carry it to world 2)"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50"
                />
                <Button onClick={advance} disabled={loading} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
                  Solve &amp; carry to world 2 <ArrowRight size={13} className="ml-1" />
                </Button>
              </div>
            )}
          </div>

          {/* world 2 */}
          {kase.template_2 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wider text-amber-400 font-mono mb-2">
                World 2 · {kase.template_2} — same principle, port the fix
              </h3>
              {symptom2?.plan && <PlanGraph plan={symptom2.plan} />}
              {!kase.context2_solved ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={fixSql}
                    onChange={(e) => setFixSql(e.target.value)}
                    placeholder="Port your fix to this world..."
                    rows={2}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50 resize-y"
                  />
                  <Button onClick={port} disabled={loading} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
                    Port fix
                  </Button>
                  {portResult && !portResult.ported && (
                    <div className="font-mono text-xs text-rose-400">
                      {portResult.error || "not fixed yet: " + (portResult.detail || "")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 font-mono text-sm text-emerald-400 flex items-center gap-2">
                  <Check size={14} /> ported
                </div>
              )}
            </div>
          )}

          {/* close */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-2 flex items-center gap-1.5">
              {kase.context1_solved && kase.context2_solved ? (
                "Explain it back — domain-independent"
              ) : (
                <>
                  <Lock size={11} /> explain-back (carry it across both worlds first)
                </>
              )}
            </h3>
            {kase.context1_solved && kase.context2_solved && !closed && (
              <div className="space-y-2">
                <textarea
                  value={explain}
                  onChange={(e) => setExplain(e.target.value)}
                  placeholder="State the principle without naming either world, e.g. 'an index on the filter column turns a full scan into a lookup when the match is selective'"
                  rows={2}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 font-mono text-sm text-neutral-200 focus:outline-none focus:border-amber-500/50 resize-y"
                />
                <Button onClick={close} disabled={loading} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
                  Close the case
                </Button>
              </div>
            )}
            {closed && (
              <div className="rounded border border-emerald-700/50 bg-emerald-500/5 px-4 py-3 font-mono text-sm text-emerald-400">
                Case closed. You carried the principle across two worlds and named it in
                your own words.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
