const BASE_URL = "http://localhost:8000";

interface APIResponse<T> {
  data: T;
  traceId: string | null;
}

async function fetchAPI<T>(
  path: string,
  options?: RequestInit
): Promise<APIResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const traceId = res.headers.get("X-Trace-Id");
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw { status: res.status, ...error, traceId };
  }
  const data = res.status === 204 ? (null as T) : await res.json();
  return { data, traceId };
}

export const api = {
  messages: {
    list: (page = 1, limit = 20) =>
      fetchAPI<any[]>(`/api/messages?page=${page}&limit=${limit}`),
    get: (id: number) => fetchAPI<any>(`/api/messages/${id}`),
    create: (body: { content: string; author: string }) =>
      fetchAPI<any>("/api/messages", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: number, body: any) =>
      fetchAPI<any>(`/api/messages/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      fetchAPI<any>(`/api/messages/${id}`, { method: "DELETE" }),
  },
  auth: {
    register: (body: { username: string; email: string; password: string }) =>
      fetchAPI<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    login: (body: { username: string; password: string }) =>
      fetchAPI<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    me: (token: string) =>
      fetchAPI<any>("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    refresh: (token: string) =>
      fetchAPI<any>("/api/auth/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
    inspectToken: (token: string) =>
      fetchAPI<any>(
        `/api/auth/inspect-token?token=${encodeURIComponent(token)}`
      ),
  },
  traces: {
    latest: () => fetchAPI<any>("/api/traces/latest"),
    list: (limit = 50) => fetchAPI<any[]>(`/api/traces?limit=${limit}`),
    get: (id: number) => fetchAPI<any>(`/api/traces/${id}`),
  },
  workshop: {
    http: {
      echo: (
        method: string,
        body?: any,
        headers?: Record<string, string>
      ) =>
        fetchAPI<any>("/api/workshop/http/echo", {
          method,
          body: body ? JSON.stringify(body) : undefined,
          headers,
        }),
      status: (code: number) =>
        fetchAPI<any>(`/api/workshop/http/status/${code}`),
      slow: (delay: number) =>
        fetchAPI<any>(`/api/workshop/http/slow?delay=${delay}`),
      contentTypes: (accept: string) =>
        fetchAPI<any>("/api/workshop/http/content-types", {
          headers: { Accept: accept },
        }),
    },
    types: {
      schema: () => fetchAPI<any>("/api/workshop/types/schema"),
      validate: (modelName: string, data: any) =>
        fetchAPI<any>(
          `/api/workshop/types/validate?model_name=${modelName}`,
          { method: "POST", body: JSON.stringify(data) }
        ),
      compare: () => fetchAPI<any>("/api/workshop/types/compare"),
      queryParamsDemo: (params: Record<string, string>) => {
        const qs = new URLSearchParams(params).toString();
        return fetchAPI<any>(`/api/workshop/types/query-params-demo?${qs}`);
      },
    },
  },
  meta: {
    source: (path: string) => fetchAPI<any>(`/api/meta/source/${path}`),
    routes: () => fetchAPI<any[]>("/api/meta/routes"),
    models: () => fetchAPI<any>("/api/meta/models"),
  },
  workbench: {
    run: (body: {
      sql: string;
      setup_sql?: string;
      allow_writes?: boolean;
      call?: { target: string; predicted: any; confidence?: number };
    }) =>
      fetchAPI<any>("/api/workbench/run", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  raw: async (url: string, options?: RequestInit) => {
    const res = await fetch(`${BASE_URL}${url}`, options);
    const traceId = res.headers.get("X-Trace-Id");
    const contentType = res.headers.get("Content-Type") || "";
    let body: any;
    if (contentType.includes("json")) body = await res.json();
    else body = await res.text();
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      body,
      traceId,
    };
  },
};
