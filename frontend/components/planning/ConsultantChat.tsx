"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

type Props = {
  projectId: string | number;
  onWarning?: (warning: string | null) => void;
  onError?: (error: string | null) => void;
};

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: string | null;
};

function BouncingLoader() {
  return (
    <div
      className="flex items-center gap-1.5 px-1 py-1"
      role="status"
      aria-label="Consultant is thinking"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2.5 w-2.5 rounded-full bg-brass [animation:plotline-bounce_0.9s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
      <span className="ml-2 text-xs text-muted">Thinking…</span>
    </div>
  );
}

function sourceLabel(source: string | null | undefined) {
  if (!source) return null;
  if (source === "huggingface") return "Hugging Face polish";
  if (source === "local_rag") return "Local RAG";
  return source;
}

export function ConsultantChat({ projectId, onWarning, onError }: Props) {
  const [question, setQuestion] = useState("Why was this house recommended?");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const [displayed, setDisplayed] = useState("");
  const [typingId, setTypingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, displayed, asking]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearInterval(typingTimer.current);
    };
  }, []);

  function startTypewriter(full: string, turnId: string) {
    if (typingTimer.current) clearInterval(typingTimer.current);
    setTypingId(turnId);
    setDisplayed("");
    const words = full.split(/(\s+)/); // keep whitespace tokens
    let i = 0;
    typingTimer.current = setInterval(() => {
      i += 1;
      setDisplayed(words.slice(0, i).join(""));
      if (i >= words.length) {
        if (typingTimer.current) clearInterval(typingTimer.current);
        typingTimer.current = null;
        setTypingId(null);
        setDisplayed(full);
      }
    }, 28);
  }

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    onError?.(null);
    setAsking(true);
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      text: q,
    };
    setTurns((prev) => [...prev, userTurn]);
    setQuestion("");
    try {
      const result = await api<{
        answer: string;
        source: string;
        warning?: string | null;
      }>(`/api/projects/${projectId}/ask/`, {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      const assistantId = `a-${Date.now()}`;
      const assistantTurn: ChatTurn = {
        id: assistantId,
        role: "assistant",
        text: result.answer,
        source: result.source,
      };
      setTurns((prev) => [...prev, assistantTurn]);
      startTypewriter(result.answer, assistantId);
      onWarning?.(result.warning ?? null);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Q&A failed");
      setTurns((prev) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: "assistant",
          text: "I could not answer just now. Please try again, or check that the backend is reachable.",
          source: null,
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl bg-white ring-1 ring-ink/10">
      <div className="border-b border-ink/8 px-6 py-5">
        <h2 className="font-serif text-2xl">Ask consultant</h2>
        <p className="mt-1 text-sm text-muted">
          Answers are grounded on project facts, HouseDesign programme, feasibility, and
          Lahore cost estimate — not invented by the model.
        </p>
      </div>

      <div className="flex max-h-[28rem] min-h-[12rem] flex-col gap-3 overflow-y-auto bg-gradient-to-b from-paper/40 to-white px-4 py-5 sm:px-6">
        {turns.length === 0 && !asking ? (
          <p className="text-center text-sm text-muted">
            Ask about rooms, cost, coverage, measurement, or why this design was matched.
          </p>
        ) : null}

        {turns.map((turn) => {
          const isUser = turn.role === "user";
          const isTyping = typingId === turn.id;
          const body = isTyping ? displayed : turn.text;
          return (
            <div
              key={turn.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[80%] ${
                  isUser
                    ? "rounded-br-md bg-ink text-paper"
                    : "rounded-bl-md bg-paper ring-1 ring-ink/10 text-ink"
                }`}
              >
                {!isUser && (
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-brass">
                    Plotline consultant
                    {turn.source ? ` · ${sourceLabel(turn.source)}` : ""}
                  </p>
                )}
                <p className="whitespace-pre-wrap">
                  {body}
                  {isTyping ? (
                    <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-brass align-middle" />
                  ) : null}
                </p>
              </div>
            </div>
          );
        })}

        {asking ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-paper px-4 py-3 ring-1 ring-ink/10">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-brass">
                Plotline consultant
              </p>
              <BouncingLoader />
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-ink/8 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            className="min-h-[3.25rem] flex-1 resize-y rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm outline-none ring-brass/30 focus:ring-2"
            rows={2}
            value={question}
            placeholder="Ask about your plot, rooms, cost, or design…"
            disabled={asking}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void ask()}
            disabled={asking || !question.trim()}
            className="shrink-0 rounded-full bg-brass px-6 py-3 text-sm font-medium text-ink disabled:opacity-50"
          >
            {asking ? "Asking…" : "Ask"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">Enter to send · Shift+Enter for a new line</p>
      </div>
    </section>
  );
}
