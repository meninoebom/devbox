import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "~/lib/api";

interface TraceData {
  id: number;
  trace_id: string;
  method: string;
  path: string;
  status_code: number;
  request_headers: Record<string, string>;
  response_headers: Record<string, string>;
  request_body: any;
  response_body: any;
  duration_ms: number;
  sql_queries: Array<{ query: string; duration_ms: number; params?: any }>;
  timestamp: string;
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
      // If trace fetch fails, still open panel with null
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const inspectRawResponse = useCallback((raw: any) => {
    setTrace({
      id: 0,
      trace_id: raw.traceId || "raw",
      method: raw.method || "GET",
      path: raw.url || "",
      status_code: raw.status,
      request_headers: raw.requestHeaders || {},
      response_headers: raw.headers || {},
      request_body: raw.requestBody || null,
      response_body: raw.body,
      duration_ms: raw.duration_ms || 0,
      sql_queries: [],
      timestamp: new Date().toISOString(),
    });
    setOpen(true);
    // Also try to fetch full trace if we have a traceId
    if (raw.traceId) {
      api.traces
        .get(Number(raw.traceId))
        .then(({ data }) => setTrace(data))
        .catch(() => {});
    }
  }, []);

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
