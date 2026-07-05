import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  useInspector,
  httpDetail,
  eventsOnLane,
  type Lane,
  type TraceEvent,
} from "./InspectorContext";
import { CodeBlock } from "./CodeBlock";
import { StatusBadge } from "./StatusBadge";

const LANE_COLORS: Record<Lane, string> = {
  http: "text-amber-400 border-amber-800",
  sql: "text-emerald-400 border-emerald-800",
  query_plan: "text-emerald-300 border-emerald-800",
  cache: "text-orange-400 border-orange-800",
  llm: "text-violet-400 border-violet-800",
  tool: "text-sky-400 border-sky-800",
  embedding: "text-fuchsia-400 border-fuchsia-800",
  memory: "text-teal-400 border-teal-800",
  loop: "text-rose-400 border-rose-800",
};

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

function LaneBadge({ lane }: { lane: Lane }) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] uppercase tracking-wider ${LANE_COLORS[lane]}`}
    >
      {lane.replace("_", " ")}
    </Badge>
  );
}

export function InspectorPanel() {
  const { trace, loading, open, setOpen } = useInspector();

  const http = httpDetail(trace);
  const sqlEvents = eventsOnLane(trace, "sql");
  const totalMs = trace?.duration_ms ?? 0;
  const scaleMs = Math.max(totalMs, 1);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-[500px] sm:w-[600px] bg-[#0f0f0f] border-l border-[#2a2a2a] p-0">
        <SheetHeader className="px-4 py-3 border-b border-[#2a2a2a]">
          <SheetTitle className="text-amber-400 font-mono text-sm flex items-center gap-2">
            Inspector
            {trace && (
              <>
                <Badge variant="outline" className="font-mono text-[10px] border-[#2a2a2a]">
                  #{trace.id}
                </Badge>
                <span className="text-neutral-500 text-xs font-normal truncate">
                  {trace.label}
                </span>
              </>
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
              <TabsTrigger value="sql" className="font-mono text-xs">
                SQL{sqlEvents.length > 0 ? ` (${sqlEvents.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="lanes" className="font-mono text-xs">Lanes</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="request" className="p-4 space-y-4 mt-0">
                {http ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-900/50 text-amber-400 border-amber-800 font-mono">
                        {http.method}
                      </Badge>
                      <span className="font-mono text-sm text-neutral-300 break-all">
                        {http.path}
                        {http.query_params ? `?${http.query_params}` : ""}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                        Headers
                      </h4>
                      <HeadersTable headers={http.request_headers} />
                    </div>
                    {http.request_body && (
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                          Body
                        </h4>
                        <CodeBlock language="json">{formatBody(http.request_body)}</CodeBlock>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-neutral-500 text-sm">
                    This trace has no HTTP lane. Open the Lanes tab.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="response" className="p-4 space-y-4 mt-0">
                {http ? (
                  <>
                    <div className="flex items-center gap-2">
                      <StatusBadge code={http.response_status} />
                      <span className="text-sm text-neutral-400">{totalMs}ms</span>
                    </div>
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                        Headers
                      </h4>
                      <HeadersTable headers={http.response_headers} />
                    </div>
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                        Body
                      </h4>
                      <CodeBlock language="json">{formatBody(http.response_body)}</CodeBlock>
                    </div>
                  </>
                ) : (
                  <p className="text-neutral-500 text-sm">No HTTP response on this trace.</p>
                )}
              </TabsContent>

              <TabsContent value="sql" className="p-4 space-y-4 mt-0">
                {sqlEvents.length === 0 ? (
                  <p className="text-neutral-500 text-sm">No SQL queries recorded</p>
                ) : (
                  sqlEvents.map((e, i) => (
                    <div key={e.id || i} className="space-y-1">
                      <div className="flex justify-between text-xs text-neutral-500">
                        <span>Query #{i + 1}</span>
                        <span className="tabular-nums">{e.duration_ms}ms</span>
                      </div>
                      <CodeBlock language="sql">{e.detail.sql}</CodeBlock>
                      {e.detail.params && (
                        <CodeBlock language="json">{formatBody(e.detail.params)}</CodeBlock>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="lanes" className="p-4 space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-wider text-neutral-500">
                    {trace.events.length} events · {totalMs}ms total
                  </h4>
                </div>
                <div className="space-y-2">
                  {trace.events.map((ev: TraceEvent, i) => {
                    const dur = ev.duration_ms ?? 0;
                    const pct = Math.max(2, Math.min(100, (dur / scaleMs) * 100));
                    return (
                      <div
                        key={ev.id || i}
                        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <LaneBadge lane={ev.lane} />
                          <span className="text-xs text-neutral-400 font-mono truncate flex-1">
                            {ev.lane === "sql"
                              ? String(ev.detail.sql || "").slice(0, 60)
                              : ev.lane === "http"
                                ? `${ev.detail.method} ${ev.detail.path}`
                                : ev.detail.summary || ""}
                          </span>
                          <span className="text-[10px] text-neutral-500 tabular-nums">
                            {dur}ms
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#111] rounded overflow-hidden">
                          <div
                            className="h-full bg-amber-500/50"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
