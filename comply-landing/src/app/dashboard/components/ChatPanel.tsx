"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getChatHistory, getChatStreamUrl } from "@/lib/api";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  scanId: string;
  prefillQuestion: string | null;
  onPrefillConsumed: () => void;
}

const STARTERS = [
  "Summarize the most critical issues",
  "Which violations should I fix first?",
  "Explain these regulations in plain English",
];

export default function ChatPanel({
  scanId,
  prefillQuestion,
  onPrefillConsumed,
}: ChatPanelProps) {
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    async function loadHistory() {
      const token = await getIdToken();
      if (!token) return;
      try {
        const data = await getChatHistory(token, scanId);
        setMessages(
          (data.messages || []).map(
            (m: { role: string; content: string; id: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            })
          )
        );
      } catch {
        // Ignore — empty history
      }
      setLoaded(true);
    }
    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  // Handle prefill from "Ask about this"
  useEffect(() => {
    if (prefillQuestion && loaded) {
      setInput(prefillQuestion);
      onPrefillConsumed();
    }
  }, [prefillQuestion, loaded, onPrefillConsumed]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || streaming) return;

      const token = await getIdToken();
      if (!token) return;

      // Add user message immediately
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setInput("");
      setStreaming(true);

      // Add empty assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const url = getChatStreamUrl(token, scanId, question);
        const eventSource = new EventSource(url);

        eventSource.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.chunk) {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + data.chunk,
                };
              }
              return updated;
            });
          }
        };

        eventSource.addEventListener("done", () => {
          eventSource.close();
          setStreaming(false);
        });

        eventSource.addEventListener("error", (e) => {
          const msgEvent = e as MessageEvent;
          if (msgEvent.data) {
            try {
              const data = JSON.parse(msgEvent.data);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: data.message || "Something went wrong.",
                  };
                }
                return updated;
              });
            } catch {
              // Ignore parse errors
            }
          }
          eventSource.close();
          setStreaming(false);
        });

        eventSource.onerror = () => {
          eventSource.close();
          setStreaming(false);
        };
      } catch {
        setStreaming(false);
      }
    },
    [getIdToken, scanId, streaming]
  );

  return (
    <div className="flex h-full flex-col rounded-2xl border border-warm-grey-200 bg-warm-grey-50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-warm-grey-200 px-4 py-3">
        <Bot className="h-4 w-4 text-warm-brown-500" />
        <span className="text-sm font-medium text-warm-grey-900">
          Compliance Advisor
        </span>
        <Sparkles className="h-3 w-3 text-warm-brown-400" />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && loaded && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-8">
            <Bot className="h-8 w-8 text-warm-grey-300" />
            <p className="text-sm text-warm-grey-500">
              Ask anything about your scan results, violations, or regulations.
            </p>
            <div className="space-y-2 w-full">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="w-full rounded-xl border border-warm-grey-200 bg-white px-3 py-2 text-left text-xs text-warm-grey-600 hover:bg-warm-grey-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-warm-brown-500 text-white"
                  : "bg-white border border-warm-grey-200 text-warm-grey-700"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">
                {msg.content}
                {streaming &&
                  i === messages.length - 1 &&
                  msg.role === "assistant" && (
                    <span className="inline-block w-1.5 h-3.5 bg-warm-brown-400 animate-pulse ml-0.5 align-middle" />
                  )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-warm-grey-200 px-3 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about violations, regulations..."
            disabled={streaming}
            className="flex-1 rounded-xl border border-warm-grey-200 bg-white px-3 py-2 text-sm text-warm-grey-900 placeholder:text-warm-grey-400 focus:outline-none focus:ring-2 focus:ring-warm-brown-300 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="rounded-xl bg-warm-brown-500 p-2 text-white hover:bg-warm-brown-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
