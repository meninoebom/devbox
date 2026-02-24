import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useInspector } from "./InspectorContext";
import { CodeBlock } from "./CodeBlock";
import { StatusBadge } from "./StatusBadge";

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers || {});
  if (entries.length === 0) return <p className="text-neutral-500 text-sm">No headers</p>;
  return (
    <table className="w-full text-sm font-mono">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-[#2a2a2a]">
            <td className="py-1.5 pr-3 text-amber-400 whitespace-nowrap">{k}</td>
            <td className="py-1.5 text-neutral-300 break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatBody(body: any): string {
  if (body === null || body === undefined) return "(empty)";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

export function InspectorPanel() {
  const { trace, loading, open, setOpen } = useInspector();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-[500px] sm:w-[600px] bg-[#0f0f0f] border-l border-[#2a2a2a] p-0">
        <SheetHeader className="px-4 py-3 border-b border-[#2a2a2a]">
          <SheetTitle className="text-amber-400 font-mono text-sm flex items-center gap-2">
            Inspector
            {trace && (
              <Badge variant="outline" className="font-mono text-[10px] border-[#2a2a2a]">
                {trace.trace_id}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-neutral-500">
            Loading trace...
          </div>
        ) : !trace ? (
          <div className="flex items-center justify-center h-64 text-neutral-500 text-sm">
            Make an API call to inspect it here
          </div>
        ) : (
          <Tabs defaultValue="request" className="flex flex-col h-[calc(100vh-60px)]">
            <TabsList className="bg-[#1a1a1a] border-b border-[#2a2a2a] rounded-none justify-start px-4">
              <TabsTrigger value="request" className="font-mono text-xs">Request</TabsTrigger>
              <TabsTrigger value="response" className="font-mono text-xs">Response</TabsTrigger>
              <TabsTrigger value="sql" className="font-mono text-xs">SQL</TabsTrigger>
              <TabsTrigger value="timeline" className="font-mono text-xs">Timeline</TabsTrigger>
              <TabsTrigger value="types" className="font-mono text-xs">Types</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="request" className="p-4 space-y-4 mt-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-900/50 text-amber-400 border-amber-800 font-mono">
                    {trace.method}
                  </Badge>
                  <span className="font-mono text-sm text-neutral-300 break-all">
                    {trace.path}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Headers
                  </h4>
                  <HeadersTable headers={trace.request_headers} />
                </div>
                {trace.request_body && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Body
                    </h4>
                    <CodeBlock language="json">
                      {formatBody(trace.request_body)}
                    </CodeBlock>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="response" className="p-4 space-y-4 mt-0">
                <div className="flex items-center gap-2">
                  <StatusBadge code={trace.status_code} />
                  <span className="text-sm text-neutral-400">
                    {trace.duration_ms}ms
                  </span>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Headers
                  </h4>
                  <HeadersTable headers={trace.response_headers} />
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Body
                  </h4>
                  <CodeBlock language="json">
                    {formatBody(trace.response_body)}
                  </CodeBlock>
                </div>
              </TabsContent>

              <TabsContent value="sql" className="p-4 space-y-4 mt-0">
                {(!trace.sql_queries || trace.sql_queries.length === 0) ? (
                  <p className="text-neutral-500 text-sm">No SQL queries recorded</p>
                ) : (
                  trace.sql_queries.map((q, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs text-neutral-500">
                        <span>Query #{i + 1}</span>
                        <span>{q.duration_ms}ms</span>
                      </div>
                      <CodeBlock language="sql">{q.query}</CodeBlock>
                      {q.params && (
                        <CodeBlock language="json">
                          {JSON.stringify(q.params, null, 2)}
                        </CodeBlock>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="timeline" className="p-4 space-y-4 mt-0">
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
                    Request Duration
                  </h4>
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-neutral-300">
                        {trace.duration_ms}ms
                      </span>
                    </div>
                    <div className="h-6 bg-[#111] rounded overflow-hidden">
                      <div
                        className="h-full bg-amber-500/60 rounded"
                        style={{
                          width: `${Math.min(100, (trace.duration_ms / Math.max(trace.duration_ms, 1000)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-neutral-600 font-mono">
                      <span>0ms</span>
                      <span>{Math.max(trace.duration_ms, 1000)}ms</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="types" className="p-4 mt-0">
                <p className="text-neutral-500 text-sm">
                  Type information will be displayed here when exploring the Type Bridge workshop.
                </p>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
