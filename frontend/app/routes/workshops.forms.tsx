import { useState, useCallback } from "react";
import { WorkshopLayout } from "~/components/layout/WorkshopLayout";
import { useInspector } from "~/components/inspector/InspectorContext";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { CodeBlock } from "~/components/inspector/CodeBlock";
import { StatusBadge } from "~/components/inspector/StatusBadge";

const BASE_URL = "http://localhost:8000";

export default function FormWorkshop() {
  const { inspectRawResponse } = useInspector();

  // JSON form
  const [jsonAuthor, setJsonAuthor] = useState("alice");
  const [jsonContent, setJsonContent] = useState("Hello from JSON!");
  const [jsonResult, setJsonResult] = useState<any>(null);

  // URL-encoded form
  const [formAuthor, setFormAuthor] = useState("bob");
  const [formContent, setFormContent] = useState("Hello from form!");
  const [formResult, setFormResult] = useState<any>(null);

  // Multipart form
  const [mpName, setMpName] = useState("My Project");
  const [mpDesc, setMpDesc] = useState("A test project");
  const [mpFile, setMpFile] = useState<File | null>(null);
  const [mpResult, setMpResult] = useState<any>(null);

  const sendJson = useCallback(async () => {
    try {
      const raw = await api.raw("/api/workshop/http/echo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: jsonAuthor, content: jsonContent }),
      });
      setJsonResult(raw);
      inspectRawResponse({ ...raw, method: "POST", url: "/api/workshop/http/echo" });
    } catch {}
  }, [jsonAuthor, jsonContent, inspectRawResponse]);

  const sendUrlEncoded = useCallback(async () => {
    try {
      const body = new URLSearchParams({ author: formAuthor, content: formContent });
      const res = await fetch(`${BASE_URL}/api/workshop/http/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      const traceId = res.headers.get("X-Trace-Id");
      const data = await res.json().catch(() => res.text());
      const result = { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), body: data, traceId };
      setFormResult(result);
      inspectRawResponse({ ...result, method: "POST", url: "/api/workshop/http/echo" });
    } catch {}
  }, [formAuthor, formContent, inspectRawResponse]);

  const sendMultipart = useCallback(async () => {
    try {
      const fd = new FormData();
      fd.append("name", mpName);
      fd.append("description", mpDesc);
      if (mpFile) fd.append("file", mpFile);
      const res = await fetch(`${BASE_URL}/api/projects`, {
        method: "POST",
        body: fd,
      });
      const traceId = res.headers.get("X-Trace-Id");
      const data = await res.json().catch(() => res.text());
      const result = { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), body: data, traceId };
      setMpResult(result);
      inspectRawResponse({ ...result, method: "POST", url: "/api/projects" });
    } catch {}
  }, [mpName, mpDesc, mpFile, inspectRawResponse]);

  function ResultCard({ label, result }: { label: string; result: any }) {
    if (!result) return null;
    return (
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">{label}</span>
          <StatusBadge code={result.status} />
        </div>
        <CodeBlock language="json">
          {typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2)}
        </CodeBlock>
      </div>
    );
  }

  return (
    <WorkshopLayout
      title="Form Workshop"
      description="Compare how different Content-Types encode the same data."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* JSON */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Badge className="bg-blue-900/50 text-blue-400 border-blue-800 font-mono text-[10px]">
                application/json
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={jsonAuthor} onChange={(e) => setJsonAuthor(e.target.value)} placeholder="Author" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
            <Input value={jsonContent} onChange={(e) => setJsonContent(e.target.value)} placeholder="Content" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
            <div className="text-[10px] text-neutral-600 font-mono p-2 bg-[#111] rounded border border-[#2a2a2a]">
              {JSON.stringify({ author: jsonAuthor, content: jsonContent })}
            </div>
            <Button onClick={sendJson} className="w-full bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
              Send JSON
            </Button>
            <ResultCard label="Response" result={jsonResult} />
          </CardContent>
        </Card>

        {/* URL-encoded */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Badge className="bg-green-900/50 text-green-400 border-green-800 font-mono text-[10px]">
                x-www-form-urlencoded
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={formAuthor} onChange={(e) => setFormAuthor(e.target.value)} placeholder="Author" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
            <Input value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder="Content" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
            <div className="text-[10px] text-neutral-600 font-mono p-2 bg-[#111] rounded border border-[#2a2a2a]">
              author={encodeURIComponent(formAuthor)}&content={encodeURIComponent(formContent)}
            </div>
            <Button onClick={sendUrlEncoded} className="w-full bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
              Send Form
            </Button>
            <ResultCard label="Response" result={formResult} />
          </CardContent>
        </Card>

        {/* Multipart */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Badge className="bg-purple-900/50 text-purple-400 border-purple-800 font-mono text-[10px]">
                multipart/form-data
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={mpName} onChange={(e) => setMpName(e.target.value)} placeholder="Project name" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
            <Input value={mpDesc} onChange={(e) => setMpDesc(e.target.value)} placeholder="Description" className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
            <div>
              <label className="text-xs text-neutral-500 block mb-1">File (optional)</label>
              <input
                type="file"
                onChange={(e) => setMpFile(e.target.files?.[0] || null)}
                className="text-sm text-neutral-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border file:border-[#2a2a2a] file:bg-[#111] file:text-neutral-400 file:font-mono file:text-xs"
              />
            </div>
            <div className="text-[10px] text-neutral-600 font-mono p-2 bg-[#111] rounded border border-[#2a2a2a]">
              --boundary\nContent-Disposition: form-data; name="name"\n\n{mpName}\n--boundary--
            </div>
            <Button onClick={sendMultipart} className="w-full bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
              Send Multipart
            </Button>
            <ResultCard label="Response" result={mpResult} />
          </CardContent>
        </Card>
      </div>
    </WorkshopLayout>
  );
}
