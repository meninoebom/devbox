import { useState, useEffect, useCallback } from "react";
import { WorkshopLayout } from "~/components/layout/WorkshopLayout";
import { useInspector } from "~/components/inspector/InspectorContext";
import { api } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { CodeBlock } from "~/components/inspector/CodeBlock";
import { Plus, Trash2, Edit2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface Message {
  id: number;
  content: string;
  author: string;
  created_at: string;
}

export default function DataPipeline() {
  const { inspectRawResponse } = useInspector();
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [lastTrace, setLastTrace] = useState<string | null>(null);

  const loadMessages = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const { data, traceId } = await api.messages.list(p, 10);
      setMessages(Array.isArray(data) ? data : []);
      if (traceId) {
        setLastTrace(traceId);
        inspectRawResponse({ status: 200, body: data, traceId, method: "GET", url: `/api/messages?page=${p}&limit=10` });
      }
    } catch {}
    setLoading(false);
  }, [page, inspectRawResponse]);

  useEffect(() => { loadMessages(page); }, [page]);

  const createMessage = useCallback(async () => {
    if (!newContent.trim() || !newAuthor.trim()) return;
    try {
      const { data, traceId } = await api.messages.create({ content: newContent, author: newAuthor });
      if (traceId) inspectRawResponse({ status: 201, body: data, traceId, method: "POST", url: "/api/messages" });
      setNewContent("");
      setNewAuthor("");
      loadMessages(page);
    } catch {}
  }, [newContent, newAuthor, page, loadMessages, inspectRawResponse]);

  const updateMessage = useCallback(async (id: number) => {
    try {
      const { data, traceId } = await api.messages.update(id, { content: editContent });
      if (traceId) inspectRawResponse({ status: 200, body: data, traceId, method: "PUT", url: `/api/messages/${id}` });
      setEditingId(null);
      loadMessages(page);
    } catch {}
  }, [editContent, page, loadMessages, inspectRawResponse]);

  const deleteMessage = useCallback(async (id: number) => {
    try {
      const { traceId } = await api.messages.delete(id);
      if (traceId) inspectRawResponse({ status: 200, body: null, traceId, method: "DELETE", url: `/api/messages/${id}` });
      loadMessages(page);
    } catch {}
  }, [page, loadMessages, inspectRawResponse]);

  return (
    <WorkshopLayout
      title="Data Pipeline"
      description="Full CRUD operations with real database writes. Every action is traceable."
    >
      <div className="space-y-6">
        {/* Pipeline Visualization */}
        <div className="flex items-center gap-2 text-xs font-mono overflow-x-auto pb-2">
          {["Client", "fetch()", "FastAPI Router", "Pydantic Validation", "SQLAlchemy ORM", "SQLite"].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-1.5 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-neutral-400">
                {step}
              </div>
              {i < arr.length - 1 && <span className="text-amber-500">→</span>}
            </div>
          ))}
        </div>

        {/* Create */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2 text-amber-400">
              <Plus size={14} /> Create Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} placeholder="Author" className="w-40 font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
              <Input value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Message content" className="flex-1 font-mono bg-[#111] border-[#2a2a2a] text-neutral-300" />
              <Button onClick={createMessage} className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
                <Plus size={14} className="mr-1" /> Create
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Messages List */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-widest text-neutral-600 font-mono">
            Messages
          </h3>
          <Button variant="ghost" size="sm" onClick={() => loadMessages(page)} className="text-neutral-500 hover:text-amber-400">
            <RefreshCw size={14} />
          </Button>
        </div>

        {loading ? (
          <p className="text-neutral-500 text-sm">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-neutral-500 text-sm">No messages yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <Card key={msg.id} className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardContent className="py-3 px-4 flex items-start justify-between gap-4">
                  {editingId === msg.id ? (
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="flex-1 font-mono bg-[#111] border-[#2a2a2a] text-neutral-300"
                        autoFocus
                      />
                      <Button onClick={() => updateMessage(msg.id)} size="sm" className="bg-amber-500 text-black hover:bg-amber-400 font-mono text-xs">
                        Save
                      </Button>
                      <Button onClick={() => setEditingId(null)} size="sm" variant="ghost" className="text-neutral-500">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] font-mono border-[#2a2a2a] text-neutral-500">
                            #{msg.id}
                          </Badge>
                          <span className="text-xs text-amber-400 font-mono">{msg.author}</span>
                          <span className="text-[10px] text-neutral-600">{new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-neutral-300">{msg.content}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}
                          className="text-neutral-500 hover:text-amber-400 h-7 w-7 p-0"
                        >
                          <Edit2 size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMessage(msg.id)}
                          className="text-neutral-500 hover:text-red-400 h-7 w-7 p-0"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-neutral-500"
          >
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs font-mono text-neutral-500">Page {page}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={messages.length < 10}
            className="text-neutral-500"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </WorkshopLayout>
  );
}
