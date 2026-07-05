import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "~/lib/api";

export type Lane =
  | "http"
  | "sql"
  | "query_plan"
  | "cache"
  | "llm"
  | "tool"
  | "embedding"
  | "memory"
  | "loop";

export interface TraceEvent {
  id: number;
  lane: Lane;
  seq: number;
  offset_ms: number;
  duration_ms: number | null;
  detail: Record<string, any>;
}

export interface TraceData {
  id: number;
  kind: "request" | "workbench_run";
  label: string;
  started_at: string;
  duration_ms: number | null;
  meta: Record<string, any> | null;
  events: TraceEvent[];
}

interface InspectorContextType {
  trace: TraceData | null;
  loading: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  inspectTrace: (traceId: string) => Promise<void>;
  inspectRawResponse: (raw: any) => void;
}

const InspectorContext = createContext<InspectorContextType | null>(null);

/** Pull the single http event's detail, if this trace has one. */
export function httpDetail(trace: TraceData | null): Record<string, any> | null {
  return trace?.events.find((e) => e.lane === "http")?.detail ?? null;
}

/** All events on a given lane, in order. */
export function eventsOnLane(trace: TraceData | null, lane: Lane): TraceEvent[] {
  return trace?.events.filter((e) => e.lane === lane) ?? [];
}

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const inspectTrace = useCallback(async (traceId: string) => {
    setLoading(true);
    try {
      const { data } = await api.traces.get(Number(traceId));
      setTrace(data);
      setOpen(true);
    } catch {
      // If the trace fetch fails, still open the panel so the user isn't left guessing.
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const inspectRawResponse = useCallback(
    (raw: any) => {
      // Real requests carry a trace id — prefer the full recorded tree.
      if (raw.traceId) {
        inspectTrace(String(raw.traceId));
        return;
      }
      // Otherwise synthesize a minimal http-only trace from what we have.
      const synthetic: TraceData = {
        id: 0,
        kind: "request",
        label: `${raw.method || "GET"} ${raw.url || ""}`.trim(),
        started_at: new Date().toISOString(),
        duration_ms: raw.duration_ms ?? 0,
        meta: null,
        events: [
          {
            id: 0,
            lane: "http",
            seq: 0,
            offset_ms: 0,
            duration_ms: raw.duration_ms ?? 0,
            detail: {
              method: raw.method || "GET",
              path: raw.url || "",
              query_params: null,
              request_headers: raw.requestHeaders || {},
              request_body: raw.requestBody ?? null,
              response_status: raw.status,
              response_headers: raw.headers || {},
              response_body: raw.body,
            },
          },
        ],
      };
      setTrace(synthetic);
      setOpen(true);
    },
    [inspectTrace]
  );

  return (
    <InspectorContext.Provider
      value={{ trace, loading, open, setOpen, inspectTrace, inspectRawResponse }}
    >
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector() {
  const ctx = useContext(InspectorContext);
  if (!ctx)
    throw new Error("useInspector must be used within InspectorProvider");
  return ctx;
}
