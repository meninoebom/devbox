import { useState, useCallback } from "react";
import { WorkshopLayout } from "~/components/layout/WorkshopLayout";
import { useInspector } from "~/components/inspector/InspectorContext";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { CodeBlock } from "~/components/inspector/CodeBlock";
import { StatusBadge } from "~/components/inspector/StatusBadge";
import { ArrowDown, Play, ChevronRight } from "lucide-react";

interface PipelineStep {
  label: string;
  description: string;
  data: any;
  format: string;
}

export default function ResponseUnwrapper() {
  const { inspectRawResponse } = useInspector();
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const runPipeline = useCallback(async () => {
    setLoading(true);
    setSteps([]);
    setActiveStep(0);

    try {
      // Step 1: Raw fetch
      const res = await fetch("http://localhost:8000/api/messages?page=1&limit=3");
      const traceId = res.headers.get("X-Trace-Id");
      const headersObj = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text();
      const jsonData = await res.clone().json().catch(() => null);

      const pipeline: PipelineStep[] = [
        {
          label: "1. HTTP Response",
          description: "Raw bytes come over the wire. Status code, headers, and body as a stream.",
          data: {
            status: res.status,
            statusText: res.statusText,
            headers: headersObj,
            bodyPreview: rawText.slice(0, 500) + (rawText.length > 500 ? "..." : ""),
          },
          format: "HTTP",
        },
        {
          label: "2. Header Extraction",
          description: "We read headers for metadata: Content-Type tells us format, X-Trace-Id links to server trace.",
          data: {
            "Content-Type": headersObj["content-type"],
            "X-Trace-Id": traceId,
            "Content-Length": headersObj["content-length"],
          },
          format: "Headers",
        },
        {
          label: "3. Body Parsing",
          description: "Response.json() parses the text body into a JavaScript object.",
          data: jsonData,
          format: "JSON",
        },
        {
          label: "4. Type Narrowing",
          description: "In TypeScript, we assert the shape matches our expected interface (e.g., Message[]).",
          data: {
            type: "Message[]",
            count: Array.isArray(jsonData) ? jsonData.length : "unknown",
            fields: Array.isArray(jsonData) && jsonData[0] ? Object.keys(jsonData[0]) : [],
          },
          format: "TypeScript",
        },
        {
          label: "5. UI Rendering",
          description: "The typed data is mapped to React components for display.",
          data: Array.isArray(jsonData)
            ? jsonData.map((m: any) => `<Card> ${m.author}: ${m.content} </Card>`).join("\n")
            : "No data to render",
          format: "JSX",
        },
      ];

      setSteps(pipeline);

      if (traceId) {
        inspectRawResponse({
          status: res.status,
          body: jsonData,
          traceId,
          method: "GET",
          url: "/api/messages?page=1&limit=3",
          headers: headersObj,
        });
      }
    } catch (e: any) {
      setSteps([
        {
          label: "Error",
          description: e.message || "Request failed",
          data: e,
          format: "Error",
        },
      ]);
    }
    setLoading(false);
  }, [inspectRawResponse]);

  return (
    <WorkshopLayout
      title="Response Unwrapper"
      description="Step through the lifecycle of an API response -- from raw bytes to rendered UI."
    >
      <div className="space-y-6">
        <Button
          onClick={runPipeline}
          disabled={loading}
          className="bg-amber-500 text-black hover:bg-amber-400 font-mono"
        >
          <Play size={14} className="mr-2" />
          {loading ? "Fetching..." : "Fetch & Unwrap"}
        </Button>

        {steps.length > 0 && (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i}>
                <button
                  onClick={() => setActiveStep(i)}
                  className={`w-full text-left border rounded-lg transition-colors ${
                    activeStep === i
                      ? "border-amber-500/40 bg-[#1a1a1a]"
                      : "border-[#2a2a2a] bg-[#1a1a1a]/50 hover:border-[#3a3a3a]"
                  }`}
                >
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
                        activeStep === i ? "bg-amber-500 text-black" : "bg-[#2a2a2a] text-neutral-500"
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-mono text-sm text-neutral-200">{step.label}</div>
                        <div className="text-xs text-neutral-500">{step.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] border-[#2a2a2a] text-neutral-500">
                        {step.format}
                      </Badge>
                      <ChevronRight size={14} className={`text-neutral-600 transition-transform ${activeStep === i ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                </button>

                {activeStep === i && (
                  <div className="mt-1 ml-8 mr-4">
                    <CodeBlock language={step.format.toLowerCase()}>
                      {typeof step.data === "string" ? step.data : JSON.stringify(step.data, null, 2)}
                    </CodeBlock>
                  </div>
                )}

                {i < steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown size={14} className="text-neutral-700" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </WorkshopLayout>
  );
}
