"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";     // disable static pre-render
export const revalidate = 0;                // no ISR
export const dynamicParams = true;          // allow unknown search params

type Source = { filename: string; page: number };
type Snippet = { filename: string; page: number; text: string };
type ChatMessage = { role: "user" | "assistant"; content: string; sources?: Source[] };
type ChatApiResponse = {
  answer?: string;
  sources?: Source[];
  snippets?: Snippet[];
  error?: string;
};

/* ---------- wrapper: satisfies "useSearchParams should be wrapped in Suspense" ---------- */
export default function ChatPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl p-6">Loading chat…</main>}>
      <ChatPageInner />
    </Suspense>
  );
}

/* --------------------------------- real page --------------------------------- */
function ChatPageInner() {
  const params = useSearchParams();
  const docId = params.get("docId") ?? "";
  const filename = params.get("file") ?? "document.pdf";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "s") {
        document.getElementById("src-drawer")?.classList.toggle("hidden");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function makeSuggestions() {
    const ideas = [
      "Summarize key points",
      "List definitions and terms",
      "Extract all dates and deadlines",
      "Where does it mention costs?",
      "Give me action items",
      "Any risks or limitations?",
    ];
    return ideas.sort(() => Math.random() - 0.5).slice(0, 3);
  }

  async function send() {
    if (!input || !docId || loading) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, docId }),
      });

      const ct = res.headers.get("content-type") || "";
      const payload: ChatApiResponse = ct.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);

      const assistant: ChatMessage = {
        role: "assistant",
        content: payload.answer ?? "",
        sources: payload.sources ?? [],
      };
      setSnippets(payload.snippets ?? []);
      setMessages((m) => [...m, assistant]);
      setSuggestions(makeSuggestions());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function addAnotherPdf(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/upload?docId=${docId}`, { method: "POST", body: fd });
    const data: { ok?: boolean; filename?: string; error?: string } = await res.json();
    if (!res.ok) return alert(data.error || "Upload failed");
    alert(`Added ${data.filename} to this collection`);
  }

  function exportChat() {
    const md =
      `# Chat with ${filename}\n\n` +
      messages.map((m) => `**${m.role}:** ${m.content}`).join("\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!docId) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-zinc-400">No document selected — go back and upload one.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 h-[100dvh] flex flex-col">
      <header className="flex items-center justify-between mb-3 gap-2">
        <h1 className="text-xl font-semibold">
          Chatting with: <span className="font-mono">{filename}</span>
        </h1>
        <div className="flex gap-2">
          <label className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900 cursor-pointer">
            Add PDF
            <input
              type="file"
              hidden
              accept="application/pdf"
              onChange={(e) => e.target.files?.[0] && addAnotherPdf(e.target.files[0])}
            />
          </label>

          <button
            onClick={() => setMessages([])}
            className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900"
          >
            New chat
          </button>
          <button
            onClick={exportChat}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            Export
          </button>
          <button
            onClick={() => document.getElementById("src-drawer")?.classList.toggle("hidden")}
            className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-900"
            title="Toggle Sources (S)"
          >
            Sources
          </button>
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto border rounded p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={[
                "inline-block max-w-[85%] px-3 py-2 rounded-lg border",
                "whitespace-pre-wrap leading-relaxed",
                m.role === "user"
                  ? "bg-blue-600 text-white border-blue-700"
                  : "bg-zinc-800 text-zinc-100 border-zinc-700",
              ].join(" ")}
            >
              <div className="prose prose-invert max-w-none">{m.content}</div>

              {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.sources.map((s, idx) => (
                    <button
                      key={idx}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-zinc-600/60 bg-zinc-900/40"
                      onClick={() => {
                        const drawer = document.getElementById("src-drawer");
                        drawer?.classList.remove("hidden");
                        const el = document.getElementById(`src-${idx}`);
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      title={`${s.filename} — p.${s.page || "?"}`}
                    >
                      [{idx + 1}]
                    </button>
                  ))}
                </div>
              )}

              {m.role === "assistant" && (
                <button
                  onClick={() => navigator.clipboard.writeText(m.content)}
                  className="mt-2 text-[10px] opacity-70 hover:opacity-100"
                >
                  Copy answer
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && <div className="text-sm text-zinc-400 animate-pulse">Thinking…</div>}

        {!messages.length && (
          <div className="text-zinc-500 text-sm">
            Ask something from the PDF, e.g. “Give me a 3-sentence summary.”
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-2 mb-1 flex flex-wrap gap-2">
          {suggestions.map((q, i) => (
            <button
              key={i}
              onClick={() => setInput(q)}
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your question… (Enter to send, Shift+Enter for newline)"
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          onClick={send}
          disabled={!docId || !input || loading}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>

      <aside
        id="src-drawer"
        className="hidden lg:flex fixed right-4 top-24 max-h-[70vh] overflow-y-auto rounded border border-zinc-800 bg-zinc-900/70 backdrop-blur p-3 space-y-3"
        style={{ width: "26rem", resize: "horizontal" as const }}
      >
        <div className="w-full">
          <h3 className="font-semibold text-sm mb-2">Sources</h3>
          {snippets.length === 0 && (
            <p className="text-xs text-zinc-400">Ask a question to see evidence.</p>
          )}
          {snippets.map((s, i) => (
            <div id={`src-${i}`} key={i} className="text-sm rounded border border-zinc-700 p-2 mb-2">
              <div className="text-xs mb-1 text-zinc-400">
                {s.filename} — p.{s.page || "?"}
              </div>
              <div className="whitespace-pre-wrap">{s.text}</div>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
