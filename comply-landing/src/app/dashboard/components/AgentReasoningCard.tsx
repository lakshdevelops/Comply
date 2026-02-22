"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Bot,
  Download,
} from "lucide-react";

interface AgentReasoningCardProps {
  agent: string;
  status: "active" | "done";
  reasoningChunks: string[];
  summary: string;
  defaultExpanded?: boolean;
}

/** Extract only human-readable status lines from raw reasoning chunks. */
function extractStatusLines(chunks: string[]): string[] {
  const fullText = chunks.join("");
  const lines = fullText.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Toggle code block state
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Skip JSON-looking lines
    if (/^[\[{"\]},]/.test(trimmed)) continue;
    // Skip lines that are clearly JSON values (  "key": "value")
    if (/^\s*"/.test(line)) continue;

    result.push(trimmed);
  }

  return result;
}

function downloadChainOfThought(agent: string, chunks: string[]) {
  const blob = new Blob([chunks.join("")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${agent.toLowerCase().replace(/\s+/g, "-")}-chain-of-thought.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgentReasoningCard({
  agent,
  status,
  reasoningChunks,
  summary,
  defaultExpanded = false,
}: AgentReasoningCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || status === "active");

  useEffect(() => {
    if (status === "active") setExpanded(true);
  }, [status]);

  const statusLines = extractStatusLines(reasoningChunks);

  return (
    <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-warm-grey-100 transition-colors"
      >
        <div className="flex-shrink-0">
          {status === "active" ? (
            <Loader2 className="h-5 w-5 text-warm-brown-500 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />
          )}
        </div>
        <Bot className="h-4 w-4 text-warm-grey-400" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-warm-grey-900">
            {agent}
          </span>
          {summary && (
            <span className="ml-2 text-xs text-warm-grey-500">
              &mdash; {summary}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-warm-grey-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-warm-grey-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && statusLines.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-warm-grey-200 px-5 py-3 space-y-1.5">
              {statusLines.map((line, i) => {
                const isLast = i === statusLines.length - 1;
                const isActive = isLast && status === "active";

                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="mt-1.5 flex-shrink-0">
                      {isActive ? (
                        <span className="block h-1.5 w-1.5 rounded-full bg-warm-brown-400 animate-pulse" />
                      ) : (
                        <span className="block h-1.5 w-1.5 rounded-full bg-warm-grey-300" />
                      )}
                    </div>
                    <span
                      className={`text-xs leading-relaxed ${
                        isActive
                          ? "text-warm-grey-700"
                          : "text-warm-grey-500"
                      }`}
                    >
                      {line}
                    </span>
                  </div>
                );
              })}

              {/* Download full chain-of-thought */}
              {status === "done" && reasoningChunks.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadChainOfThought(agent, reasoningChunks);
                  }}
                  className="mt-2 flex items-center gap-1.5 text-[11px] text-warm-grey-400 hover:text-warm-grey-600 transition-colors"
                >
                  <Download className="h-3 w-3" />
                  Download full chain-of-thought
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
