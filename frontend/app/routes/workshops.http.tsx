import { useState, useCallback } from "react";
import { WorkshopLayout } from "~/components/layout/WorkshopLayout";
import { useInspector } from "~/components/inspector/InspectorContext";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { StatusBadge } from "~/components/inspector/StatusBadge";
import { CodeBlock } from "~/components/inspector/CodeBlock";
import { Send, Zap, Clock, FileType } from "lucide-react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const STATUS_CODES = [
  { code: 200, label: "OK" },
  { code: 201, label: "Created" },
  { code: 204, label: "No Content" },
  { code: 301, label: "Moved" },
  { code: 400, label: "Bad Request" },
  { code: 401, label: "Unauthorized" },
  { code: 403, label: "Forbidden" },
  { code: 404, label: "Not Found" },
  { code: 422, label: "Unprocessable" },
  { code: 500, label: "Server Error" },
];

const CONTENT_TYPES = [
  { accept: "application/json", label: "JSON" },
  { accept: "text/html", label: "HTML" },
  { accept: "text/plain", label: "Plain Text" },
  { accept: "application/xml", label: "XML" },
];

export default function HttpObservatory() {
  const { inspectRawResponse } = useInspector();
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("/api/workshop/http/echo");
  const [headersText, setHeadersText] = useState("");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [delay, setDelay] = useState(1);
  const [slowResult, setSlowResult] = useState<any>(null);
  const [slowLoading, setSlowLoading] = useState(false);

  const sendRequest = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    try {
      const extraHeaders: Record<string, string> = {};
      headersText.split("\n").forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > 0) {
          extraHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      });

      const start = performance.now();
      const raw = await api.raw(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...extraHeaders,
        },
        body: ["GET", "HEAD", "OPTIONS"].includes(method) ? undefined : body || undefined,
      });
      const duration = Math.round(performance.now() - start);

      const result = { ...raw, method, url, requestHeaders: extraHeaders, requestBody: body, duration_ms: duration };
      setResponse(result);
      inspectRawResponse(result);
    } catch (e: any) {
      setResponse({ error: e.message || "Request failed" });
    } finally {
      setLoading(false);
    }
  }, [method, url, headersText, body, inspectRawResponse]);

  const sendStatusRequest = useCallback(
    async (code: number) => {
      try {
        const raw = await api.raw(`/api/workshop/http/status/${code}`, {});
        inspectRawResponse({ ...raw, method: "GET", url: `/api/workshop/http/status/${code}` });
        setResponse(raw);
      } catch {}
    },
    [inspectRawResponse]
  );

  const sendSlowRequest = useCallback(async () => {
    setSlowLoading(true);
    setSlowResult(null);
    const start = performance.now();
    try {
      const raw = await api.raw(`/api/workshop/http/slow?delay=${delay}`, {});
      const duration = Math.round(performance.now() - start);
      setSlowResult({ ...raw, duration_ms: duration });
      inspectRawResponse({ ...raw, method: "GET", url: `/api/workshop/http/slow?delay=${delay}`, duration_ms: duration });
    } catch {
      setSlowResult({ error: "Timed out" });
    } finally {
      setSlowLoading(false);
    }
  }, [delay, inspectRawResponse]);

  const sendContentType = useCallback(
    async (accept: string) => {
      try {
        const raw = await api.raw("/api/workshop/http/content-types", {
          headers: { Accept: accept },
        });
        inspectRawResponse({ ...raw, method: "GET", url: "/api/workshop/http/content-types" });
        setResponse(raw);
      } catch {}
    },
    [inspectRawResponse]
  );

  return (
    <WorkshopLayout
      title="HTTP Observatory"
      description="Send real HTTP requests, inspect every header, and explore how the protocol works."
    >
      <Tabs defaultValue="builder" className="space-y-6">
        <TabsList className="bg-[#1a1a1a] border border-[#2a2a2a]">
          <TabsTrigger value="builder" className="font-mono text-xs">
            <Send size={14} className="mr-1.5" /> Request Builder
          </TabsTrigger>
          <TabsTrigger value="status" className="font-mono text-xs">
            <Zap size={14} className="mr-1.5" /> Status Codes
          </TabsTrigger>
          <TabsTrigger value="slow" className="font-mono text-xs">
            <Clock size={14} className="mr-1.5" /> Slow Requests
          </TabsTrigger>
          <TabsTrigger value="content" className="font-mono text-xs">
            <FileType size={14} className="mr-1.5" /> Content Negotiation
          </TabsTrigger>
        </TabsList>

        {/* Request Builder */}
        <TabsContent value="builder" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-[130px] font-mono bg-[#111] border-[#2a2a2a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m} className="font-mono">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="font-mono bg-[#111] border-[#2a2a2a] text-neutral-300"
                  placeholder="/api/..."
                />
                <Button
                  onClick={sendRequest}
                  disabled={loading}
                  className="bg-amber-500 text-black hover:bg-amber-400 font-mono"
                >
                  {loading ? "..." : "Send"}
                </Button>
              </div>

              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wider block mb-1">
                  Headers (one per line, Key: Value)
                </label>
                <Textarea
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  className="font-mono text-sm bg-[#111] border-[#2a2a2a] text-neutral-300 h-20"
                  placeholder="X-Custom-Header: value"
                />
              </div>

              {!["GET", "HEAD", "OPTIONS"].includes(method) && (
                <div>
                  <label className="text-xs text-neutral-500 uppercase tracking-wider block mb-1">
                    Body (JSON)
                  </label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="font-mono text-sm bg-[#111] border-[#2a2a2a] text-neutral-300 h-32"
                    placeholder='{"key": "value"}'
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {response && !response.error && (
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  Response
                  <StatusBadge code={response.status} />
                  <span className="text-neutral-500 text-xs">{response.statusText}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock language="json">
                  {typeof response.body === "string"
                    ? response.body
                    : JSON.stringify(response.body, null, 2)}
                </CodeBlock>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Status Codes */}
        <TabsContent value="status" className="space-y-4">
          <p className="text-sm text-neutral-400">
            Click any status code to send a request that returns it. Check the Inspector to see the full response.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {STATUS_CODES.map((s) => (
              <button
                key={s.code}
                onClick={() => sendStatusRequest(s.code)}
                className="border border-[#2a2a2a] rounded-lg p-4 bg-[#1a1a1a] hover:border-amber-500/40 transition-colors text-left"
              >
                <div className="font-mono text-lg font-bold mb-1">
                  <StatusBadge code={s.code} />
                </div>
                <div className="text-xs text-neutral-500">{s.label}</div>
              </button>
            ))}
          </div>
        </TabsContent>

        {/* Slow Requests */}
        <TabsContent value="slow" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-neutral-400">
                Test how your app handles slow responses. Drag the slider to set a server-side delay.
              </p>
              <div className="flex items-center gap-4">
                <label className="text-sm font-mono text-neutral-300 whitespace-nowrap">
                  Delay: {delay}s
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.5}
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <Button
                  onClick={sendSlowRequest}
                  disabled={slowLoading}
                  className="bg-amber-500 text-black hover:bg-amber-400 font-mono"
                >
                  {slowLoading ? `Waiting...` : "Send"}
                </Button>
              </div>
              {slowResult && !slowResult.error && (
                <div className="flex items-center gap-3 text-sm font-mono">
                  <StatusBadge code={slowResult.status} />
                  <span className="text-neutral-400">
                    Took <span className="text-amber-400">{slowResult.duration_ms}ms</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Negotiation */}
        <TabsContent value="content" className="space-y-4">
          <p className="text-sm text-neutral-400">
            The same endpoint returns different formats based on the Accept header.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.accept}
                onClick={() => sendContentType(ct.accept)}
                className="border border-[#2a2a2a] rounded-lg p-4 bg-[#1a1a1a] hover:border-amber-500/40 transition-colors text-left"
              >
                <div className="font-mono text-sm font-medium text-neutral-200 mb-1">
                  {ct.label}
                </div>
                <div className="text-[10px] text-neutral-500 font-mono">{ct.accept}</div>
              </button>
            ))}
          </div>
          {response && !response.error && (
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  Response
                  <Badge variant="outline" className="font-mono text-[10px] border-[#2a2a2a] text-neutral-500">
                    {response.headers?.["content-type"] || "unknown"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock>
                  {typeof response.body === "string"
                    ? response.body
                    : JSON.stringify(response.body, null, 2)}
                </CodeBlock>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </WorkshopLayout>
  );
}
