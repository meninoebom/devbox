import { useState, useEffect, useCallback } from "react";
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
import { CodeBlock } from "~/components/inspector/CodeBlock";
import { FileCode2, CheckCircle, XCircle, GitCompare, Search } from "lucide-react";

export default function TypeBridge() {
  const { inspectRawResponse } = useInspector();
  const [schema, setSchema] = useState<any>(null);
  const [modelName, setModelName] = useState("");
  const [modelNames, setModelNames] = useState<string[]>([]);
  const [validationJson, setValidationJson] = useState('{\n  "content": "hello",\n  "author": "world"\n}');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [queryParams, setQueryParams] = useState<Record<string, string>>({
    name: "test",
    page: "1",
    active: "true",
  });
  const [queryResult, setQueryResult] = useState<any>(null);

  useEffect(() => {
    api.workshop.types.schema().then(({ data, traceId }) => {
      setSchema(data);
      const names = Object.keys(data?.models || data || {});
      setModelNames(names);
      if (names.length > 0) setModelName(names[0]);
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: "/api/workshop/types/schema" });
    }).catch(() => {});
  }, []);

  const validate = useCallback(async () => {
    try {
      const parsed = JSON.parse(validationJson);
      const { data, traceId } = await api.workshop.types.validate(modelName, parsed);
      setValidationResult(data);
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "POST", url: `/api/workshop/types/validate?model_name=${modelName}` });
    } catch (e: any) {
      if (e.status) {
        setValidationResult({ valid: false, errors: e.detail || e });
        if (e.traceId) inspectRawResponse({ status: e.status, body: e, traceId: e.traceId, method: "POST", url: `/api/workshop/types/validate?model_name=${modelName}` });
      } else {
        setValidationResult({ valid: false, errors: [{ msg: "Invalid JSON" }] });
      }
    }
  }, [modelName, validationJson, inspectRawResponse]);

  const loadComparison = useCallback(async () => {
    try {
      const { data, traceId } = await api.workshop.types.compare();
      setComparison(data);
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: "/api/workshop/types/compare" });
    } catch {}
  }, [inspectRawResponse]);

  const testQueryParams = useCallback(async () => {
    try {
      const { data, traceId } = await api.workshop.types.queryParamsDemo(queryParams);
      setQueryResult(data);
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: "/api/workshop/types/query-params-demo" });
    } catch (e: any) {
      setQueryResult(e);
    }
  }, [queryParams, inspectRawResponse]);

  return (
    <WorkshopLayout
      title="Type Bridge"
      description="Explore how Pydantic models become JSON Schema and flow into TypeScript types."
    >
      <Tabs defaultValue="schema" className="space-y-6">
        <TabsList className="bg-[#1a1a1a] border border-[#2a2a2a]">
          <TabsTrigger value="schema" className="font-mono text-xs">
            <FileCode2 size={14} className="mr-1.5" /> Schema Viewer
          </TabsTrigger>
          <TabsTrigger value="validate" className="font-mono text-xs">
            <CheckCircle size={14} className="mr-1.5" /> Validate
          </TabsTrigger>
          <TabsTrigger value="compare" className="font-mono text-xs">
            <GitCompare size={14} className="mr-1.5" /> Compare
          </TabsTrigger>
          <TabsTrigger value="query" className="font-mono text-xs">
            <Search size={14} className="mr-1.5" /> Query Params
          </TabsTrigger>
        </TabsList>

        {/* Schema Viewer */}
        <TabsContent value="schema" className="space-y-4">
          {schema ? (
            <CodeBlock language="json">{JSON.stringify(schema, null, 2)}</CodeBlock>
          ) : (
            <p className="text-neutral-500 text-sm">Loading schema...</p>
          )}
        </TabsContent>

        {/* Validation */}
        <TabsContent value="validate" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2">
                <Select value={modelName} onValueChange={setModelName}>
                  <SelectTrigger className="w-[200px] font-mono bg-[#111] border-[#2a2a2a]">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelNames.map((n) => (
                      <SelectItem key={n} value={n} className="font-mono">
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={validate} className="bg-amber-500 text-black hover:bg-amber-400 font-mono">
                  Validate
                </Button>
              </div>
              <Textarea
                value={validationJson}
                onChange={(e) => setValidationJson(e.target.value)}
                className="font-mono text-sm bg-[#111] border-[#2a2a2a] text-neutral-300 h-40"
              />
              {validationResult && (
                <div className={`p-4 rounded border ${validationResult.valid !== false ? "border-green-800 bg-green-900/20" : "border-red-800 bg-red-900/20"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {validationResult.valid !== false ? (
                      <><CheckCircle size={16} className="text-green-400" /><span className="text-green-400 font-mono text-sm">Valid</span></>
                    ) : (
                      <><XCircle size={16} className="text-red-400" /><span className="text-red-400 font-mono text-sm">Invalid</span></>
                    )}
                  </div>
                  <CodeBlock language="json">{JSON.stringify(validationResult, null, 2)}</CodeBlock>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compare */}
        <TabsContent value="compare" className="space-y-4">
          <Button onClick={loadComparison} className="bg-amber-500 text-black hover:bg-amber-400 font-mono">
            Load Comparison
          </Button>
          {comparison && (
            <CodeBlock language="json">{JSON.stringify(comparison, null, 2)}</CodeBlock>
          )}
        </TabsContent>

        {/* Query Params */}
        <TabsContent value="query" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-neutral-400">
                See how query string parameters get parsed and typed by FastAPI.
              </p>
              {Object.entries(queryParams).map(([key, value]) => (
                <div key={key} className="flex gap-2 items-center">
                  <Input
                    value={key}
                    readOnly
                    className="w-32 font-mono bg-[#111] border-[#2a2a2a] text-neutral-500"
                  />
                  <span className="text-neutral-600">=</span>
                  <Input
                    value={value}
                    onChange={(e) => setQueryParams((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="flex-1 font-mono bg-[#111] border-[#2a2a2a] text-neutral-300"
                  />
                </div>
              ))}
              <Button onClick={testQueryParams} className="bg-amber-500 text-black hover:bg-amber-400 font-mono">
                Send
              </Button>
              {queryResult && (
                <CodeBlock language="json">{JSON.stringify(queryResult, null, 2)}</CodeBlock>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </WorkshopLayout>
  );
}
