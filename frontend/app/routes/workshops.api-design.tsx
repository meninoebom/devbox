import { useState, useEffect, useCallback } from "react";
import { WorkshopLayout } from "~/components/layout/WorkshopLayout";
import { useInspector } from "~/components/inspector/InspectorContext";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CodeBlock } from "~/components/inspector/CodeBlock";
import { StatusBadge } from "~/components/inspector/StatusBadge";
import { List, AlertCircle, FileText, Send } from "lucide-react";

const ERROR_CODES = [400, 401, 403, 404, 405, 422, 500, 502, 503];

export default function ApiDesignStudio() {
  const { inspectRawResponse } = useInspector();
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [errorResults, setErrorResults] = useState<Record<number, any>>({});

  useEffect(() => {
    api.meta.routes().then(({ data, traceId }) => {
      setRoutes(Array.isArray(data) ? data : []);
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: "/api/meta/routes" });
    }).catch(() => {});
  }, []);

  const testRoute = useCallback(async (route: any) => {
    setSelectedRoute(route);
    try {
      const raw = await api.raw(route.path, { method: route.methods?.[0] || "GET" });
      setTestResult(raw);
      inspectRawResponse({ ...raw, method: route.methods?.[0] || "GET", url: route.path });
    } catch {}
  }, [inspectRawResponse]);

  const testError = useCallback(async (code: number) => {
    try {
      const raw = await api.raw(`/api/workshop/http/status/${code}`, {});
      setErrorResults((prev) => ({ ...prev, [code]: raw }));
      inspectRawResponse({ ...raw, method: "GET", url: `/api/workshop/http/status/${code}` });
    } catch {}
  }, [inspectRawResponse]);

  const methodColor = (m: string) => {
    const colors: Record<string, string> = {
      GET: "bg-green-900/50 text-green-400 border-green-800",
      POST: "bg-blue-900/50 text-blue-400 border-blue-800",
      PUT: "bg-amber-900/50 text-amber-400 border-amber-800",
      PATCH: "bg-purple-900/50 text-purple-400 border-purple-800",
      DELETE: "bg-red-900/50 text-red-400 border-red-800",
    };
    return colors[m] || "bg-neutral-800 text-neutral-400 border-neutral-700";
  };

  return (
    <WorkshopLayout
      title="API Design Studio"
      description="Explore how the API is structured -- routes, error patterns, and documentation."
    >
      <Tabs defaultValue="routes" className="space-y-6">
        <TabsList className="bg-[#1a1a1a] border border-[#2a2a2a]">
          <TabsTrigger value="routes" className="font-mono text-xs"><List size={14} className="mr-1.5" /> Routes</TabsTrigger>
          <TabsTrigger value="errors" className="font-mono text-xs"><AlertCircle size={14} className="mr-1.5" /> Error Explorer</TabsTrigger>
          <TabsTrigger value="docs" className="font-mono text-xs"><FileText size={14} className="mr-1.5" /> Documentation</TabsTrigger>
        </TabsList>

        {/* Route List */}
        <TabsContent value="routes" className="space-y-3">
          {routes.length === 0 ? (
            <p className="text-neutral-500 text-sm">Loading routes...</p>
          ) : (
            routes.map((route, i) => (
              <Card key={i} className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {(route.methods || [route.method || "GET"]).map((m: string) => (
                        <Badge key={m} variant="outline" className={`font-mono text-[10px] ${methodColor(m)}`}>
                          {m}
                        </Badge>
                      ))}
                    </div>
                    <span className="font-mono text-sm text-neutral-300">{route.path}</span>
                    {route.name && (
                      <span className="text-xs text-neutral-600">({route.name})</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testRoute(route)}
                    className="text-neutral-500 hover:text-amber-400"
                  >
                    <Send size={12} />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}

          {testResult && selectedRoute && (
            <Card className="bg-[#1a1a1a] border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  {selectedRoute.path} <StatusBadge code={testResult.status} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock language="json">
                  {typeof testResult.body === "string" ? testResult.body : JSON.stringify(testResult.body, null, 2)}
                </CodeBlock>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Error Explorer */}
        <TabsContent value="errors" className="space-y-4">
          <p className="text-sm text-neutral-400">
            Trigger specific error codes and inspect how the API formats error responses.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {ERROR_CODES.map((code) => (
              <button
                key={code}
                onClick={() => testError(code)}
                className={`border rounded-lg p-3 bg-[#1a1a1a] hover:border-amber-500/40 transition-colors text-center ${
                  errorResults[code] ? "border-amber-500/30" : "border-[#2a2a2a]"
                }`}
              >
                <StatusBadge code={code} />
              </button>
            ))}
          </div>
          {Object.entries(errorResults).map(([code, result]) => (
            <Card key={code} className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <StatusBadge code={Number(code)} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock language="json">
                  {typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2)}
                </CodeBlock>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Docs */}
        <TabsContent value="docs" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-mono text-sm text-amber-400">API Endpoints</h3>
              <div className="space-y-4">
                {routes.map((route, i) => (
                  <div key={i} className="border-b border-[#2a2a2a] pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      {(route.methods || [route.method || "GET"]).map((m: string) => (
                        <Badge key={m} variant="outline" className={`font-mono text-[10px] ${methodColor(m)}`}>
                          {m}
                        </Badge>
                      ))}
                      <code className="font-mono text-sm text-neutral-200">{route.path}</code>
                    </div>
                    {route.description && (
                      <p className="text-sm text-neutral-500 ml-1">{route.description}</p>
                    )}
                    {route.name && (
                      <p className="text-xs text-neutral-600 font-mono ml-1">Handler: {route.name}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </WorkshopLayout>
  );
}
