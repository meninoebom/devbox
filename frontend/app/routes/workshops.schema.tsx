import { useState, useEffect, useCallback } from "react";
import { WorkshopLayout } from "~/components/layout/WorkshopLayout";
import { useInspector } from "~/components/inspector/InspectorContext";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { CodeBlock } from "~/components/inspector/CodeBlock";
import { Box, ArrowRight } from "lucide-react";

interface ModelField {
  name: string;
  type: string;
  required: boolean;
}

interface ModelInfo {
  name: string;
  fields: ModelField[];
  relationships?: string[];
}

export default function SchemaForge() {
  const { inspectRawResponse } = useInspector();
  const [models, setModels] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.meta.models().then(({ data, traceId }) => {
      setModels(data);
      setLoading(false);
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: "/api/meta/models" });
    }).catch(() => setLoading(false));
  }, []);

  const modelNames = models ? Object.keys(models) : [];
  const selectedData = selectedModel && models ? models[selectedModel] : null;

  // Extract fields from JSON schema-like structure
  const extractFields = (model: any): ModelField[] => {
    if (!model) return [];
    const props = model.properties || model.fields || model;
    if (typeof props !== "object") return [];
    const required = model.required || [];
    return Object.entries(props).map(([name, def]: [string, any]) => ({
      name,
      type: def?.type || def?.anyOf?.map((a: any) => a.type).join(" | ") || String(def),
      required: required.includes(name),
    }));
  };

  return (
    <WorkshopLayout
      title="Schema Forge"
      description="Browse the data models that power the API and see how they relate."
    >
      {loading ? (
        <p className="text-neutral-500 text-sm">Loading models...</p>
      ) : !models ? (
        <p className="text-neutral-500 text-sm">No models available. Is the backend running?</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Model Browser */}
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-neutral-600 font-mono mb-3">Models</h3>
            {modelNames.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedModel(name)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center gap-2 ${
                  selectedModel === name
                    ? "border-amber-500/40 bg-[#1a1a1a] text-amber-400"
                    : "border-[#2a2a2a] bg-[#1a1a1a]/50 text-neutral-400 hover:border-[#3a3a3a]"
                }`}
              >
                <Box size={14} />
                <span className="font-mono text-sm">{name}</span>
              </button>
            ))}
          </div>

          {/* Model Detail */}
          <div className="lg:col-span-2 space-y-4">
            {selectedData ? (
              <>
                <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                  <CardHeader>
                    <CardTitle className="font-mono text-sm text-amber-400 flex items-center gap-2">
                      <Box size={14} /> {selectedModel}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-sm font-mono">
                      <thead>
                        <tr className="border-b border-[#2a2a2a]">
                          <th className="text-left py-2 text-neutral-500 text-xs">Field</th>
                          <th className="text-left py-2 text-neutral-500 text-xs">Type</th>
                          <th className="text-left py-2 text-neutral-500 text-xs">Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractFields(selectedData).map((f) => (
                          <tr key={f.name} className="border-b border-[#2a2a2a]/50">
                            <td className="py-2 text-neutral-200">{f.name}</td>
                            <td className="py-2 text-blue-400">{f.type}</td>
                            <td className="py-2">
                              {f.required ? (
                                <Badge variant="outline" className="text-[10px] border-amber-800 text-amber-400">required</Badge>
                              ) : (
                                <span className="text-neutral-600 text-xs">optional</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-mono text-xs text-neutral-500">Raw Schema</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CodeBlock language="json">{JSON.stringify(selectedData, null, 2)}</CodeBlock>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-neutral-600 text-sm">
                Select a model to inspect its schema
              </div>
            )}
          </div>

          {/* Simple ER Diagram */}
          {modelNames.length > 1 && (
            <div className="lg:col-span-3">
              <h3 className="text-xs uppercase tracking-widest text-neutral-600 font-mono mb-3">
                Entity Relationships
              </h3>
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    {modelNames.map((name, i) => (
                      <div key={name} className="flex items-center gap-3">
                        <div
                          className={`px-4 py-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedModel === name
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                              : "border-[#2a2a2a] text-neutral-400 hover:border-[#3a3a3a]"
                          }`}
                          onClick={() => setSelectedModel(name)}
                        >
                          <div className="font-mono text-sm font-medium">{name}</div>
                          <div className="text-[10px] text-neutral-600">
                            {extractFields(models[name]).length} fields
                          </div>
                        </div>
                        {i < modelNames.length - 1 && (
                          <ArrowRight size={14} className="text-neutral-700" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </WorkshopLayout>
  );
}
