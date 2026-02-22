# Scan UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat violation card list with a grouped-by-file view + filter chips, and add a persistent Compliance Advisor chat panel powered by Gemini.

**Architecture:** Two-column layout (violations left, chat right) with a new SSE chat endpoint. The chat LLM receives a compact violations summary + all referenced regulation contexts upfront, plus conversation history from the DB. No function calling — the regulation set per scan is small enough to include in the system prompt.

**Tech Stack:** Next.js 16 / React 19, Tailwind v4 (warm-grey/warm-brown theme), motion (Framer Motion), lucide-react icons, FastAPI backend, SQLite, Gemini via google.generativeai.

**Design doc:** `docs/plans/2026-02-22-scan-ui-redesign-design.md`

---

### Task 1: Add `chat_messages` table

**Files:**
- Modify: `backend/app/database.py` (after line 88, the qa_results table)

**Step 1: Add table creation**

In `init_db()`, after the `qa_results` CREATE TABLE block (line 88), add:

```python
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            references_json TEXT,
            created_at TEXT NOT NULL
        )
    """)
```

**Step 2: Add cascade delete in scan route**

Modify: `backend/app/routes/scan.py` line 318 — add before the `reasoning_log` delete:

```python
    db.execute("DELETE FROM chat_messages WHERE scan_id = ?", (scan_id,))
```

**Step 3: Verify**

Run: `python3 -c "from app.database import init_db; init_db(); print('OK')"`
Expected: OK, no errors.

**Step 4: Commit**

```bash
git add backend/app/database.py backend/app/routes/scan.py
git commit -m "feat: add chat_messages table and cascade delete"
```

---

### Task 2: Add `ChatRequest` schema

**Files:**
- Modify: `backend/app/models/schemas.py` (append after line 70)

**Step 1: Add schema**

```python
class ChatRequest(BaseModel):
    scan_id: str
    question: str
```

**Step 2: Commit**

```bash
git add backend/app/models/schemas.py
git commit -m "feat: add ChatRequest schema"
```

---

### Task 3: Create chat route with SSE streaming

**Files:**
- Create: `backend/app/routes/chat.py`

**Step 1: Write the chat route**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.core.security import _ensure_firebase_initialized
from app.database import get_db
from app.models.schemas import ChatRequest
from app.agents.gemini_client import invoke_streaming
from app.services.regulation_service import get_article_context
from firebase_admin import auth as firebase_auth
import json
import uuid
from datetime import datetime

router = APIRouter()

ADVISOR_SYSTEM_PROMPT = """You are a compliance advisor helping non-technical users understand infrastructure compliance violations.

You have access to the following scan results and regulatory context. Use them to answer the user's questions in plain, accessible language.

SCAN VIOLATIONS:
{violations_summary}

REGULATORY CONTEXT:
{regulation_context}

Guidelines:
- Explain technical concepts in plain language suitable for compliance officers
- Reference specific violations by their file and description when relevant
- Cite regulation articles when explaining requirements
- Be concise but thorough
- If asked about priority, consider severity and business impact
- Do not make up regulations or requirements not present in the context"""


def _build_violations_summary(scan_id: str) -> tuple[str, str]:
    """Build compact violations summary and regulation context for the LLM."""
    db = get_db()
    violations = [
        dict(row) for row in db.execute(
            "SELECT * FROM violations WHERE scan_id = ?", (scan_id,)
        ).fetchall()
    ]
    plans = [
        dict(row) for row in db.execute(
            "SELECT * FROM remediation_plans WHERE scan_id = ?", (scan_id,)
        ).fetchall()
    ]
    db.close()

    # Build plan lookup
    plan_map = {p["violation_id"]: p for p in plans}

    # Compact summary
    summary_lines = []
    regulation_refs = set()
    for v in violations:
        plan = plan_map.get(v["id"], {})
        line = (
            f"- [{v.get('severity', 'medium').upper()}] {v.get('file', '')}:{v.get('line', '?')} "
            f"— {v.get('description', '')} "
            f"(regulation: {v.get('regulation_ref', 'N/A')})"
        )
        if plan.get("what_needs_to_change"):
            line += f" Fix: {plan['what_needs_to_change']}"
        summary_lines.append(line)
        if v.get("regulation_ref"):
            regulation_refs.add(v["regulation_ref"])

    # Fetch all referenced regulation contexts
    reg_sections = []
    for ref in sorted(regulation_refs):
        ctx = get_article_context(ref)
        if ctx:
            reg_sections.append(f"### {ref}\n{json.dumps(ctx, indent=2)}")

    return "\n".join(summary_lines), "\n\n".join(reg_sections) or "No regulatory texts available."


def _get_conversation_history(scan_id: str, user_id: str, limit: int = 20) -> list[dict]:
    """Fetch recent chat history from DB."""
    db = get_db()
    rows = db.execute(
        "SELECT role, content FROM chat_messages WHERE scan_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?",
        (scan_id, user_id, limit),
    ).fetchall()
    db.close()
    # Reverse to chronological order
    return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]


def _save_message(scan_id: str, user_id: str, role: str, content: str, references_json: str = None):
    """Save a chat message to the DB."""
    db = get_db()
    db.execute(
        "INSERT INTO chat_messages (id, scan_id, user_id, role, content, references_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), scan_id, user_id, role, content, references_json, datetime.utcnow().isoformat()),
    )
    db.commit()
    db.close()


@router.get("/chat/{scan_id}")
def get_chat_history(scan_id: str, user: dict = Depends(get_current_user)):
    """Return chat history for a scan."""
    db = get_db()
    scan = db.execute(
        "SELECT id FROM scans WHERE id = ? AND user_id = ?", (scan_id, user["uid"])
    ).fetchone()
    if not scan:
        db.close()
        raise HTTPException(status_code=404, detail="Scan not found")

    rows = db.execute(
        "SELECT id, role, content, references_json, created_at FROM chat_messages WHERE scan_id = ? AND user_id = ? ORDER BY created_at",
        (scan_id, user["uid"]),
    ).fetchall()
    db.close()

    return {
        "messages": [
            {
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "references": json.loads(row["references_json"]) if row["references_json"] else None,
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


@router.get("/chat/{scan_id}/stream")
def stream_chat(scan_id: str, question: str = Query(...), token: str = Query(...)):
    """SSE endpoint that streams the advisor's response."""
    # Auth via query param (EventSource can't set headers)
    _ensure_firebase_initialized()
    try:
        user = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    user_id = user["uid"]

    # Verify scan belongs to user
    db = get_db()
    scan = db.execute(
        "SELECT id FROM scans WHERE id = ? AND user_id = ?", (scan_id, user_id)
    ).fetchone()
    db.close()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    def event_generator():
        try:
            # Save user message
            _save_message(scan_id, user_id, "user", question)

            # Build context
            violations_summary, regulation_context = _build_violations_summary(scan_id)
            history = _get_conversation_history(scan_id, user_id)

            system_prompt = ADVISOR_SYSTEM_PROMPT.format(
                violations_summary=violations_summary,
                regulation_context=regulation_context,
            )

            # Build user content with conversation history
            history_text = ""
            if len(history) > 1:  # More than just the current question
                for msg in history[:-1]:  # Exclude current question (already saved)
                    role_label = "User" if msg["role"] == "user" else "Advisor"
                    history_text += f"{role_label}: {msg['content']}\n\n"

            user_content = ""
            if history_text:
                user_content += f"CONVERSATION HISTORY:\n{history_text}\n"
            user_content += f"CURRENT QUESTION:\n{question}"

            # Stream response
            full_response = ""
            for chunk in invoke_streaming(system_prompt=system_prompt, user_content=user_content):
                full_response += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

            # Save assistant message
            _save_message(scan_id, user_id, "assistant", full_response)

            yield f"event: done\ndata: {json.dumps({'complete': True})}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

**Step 2: Register the router**

Modify: `backend/app/api/router.py` — add import and include:

```python
from app.routes import scan, fixes, legal, github, chat

# After the github line:
router.include_router(chat.router, tags=["chat"])
```

**Step 3: Verify backend starts**

Run: restart uvicorn, check for import errors in logs.

**Step 4: Commit**

```bash
git add backend/app/routes/chat.py backend/app/api/router.py
git commit -m "feat: add compliance advisor chat endpoint with SSE streaming"
```

---

### Task 4: Add frontend API helpers for chat

**Files:**
- Modify: `comply-landing/src/lib/api.ts` (append after line 96)

**Step 1: Add chat API functions**

```typescript
// Chat
export const getChatHistory = (token: string, scanId: string) =>
  apiFetch(`/chat/${scanId}`, {}, token);

export const getChatStreamUrl = (
  token: string,
  scanId: string,
  question: string
) =>
  `${API_BASE}/chat/${scanId}/stream?token=${encodeURIComponent(token)}&question=${encodeURIComponent(question)}`;
```

**Step 2: Commit**

```bash
git add comply-landing/src/lib/api.ts
git commit -m "feat: add chat API helpers"
```

---

### Task 5: Create ViolationGroup component

**Files:**
- Create: `comply-landing/src/app/dashboard/components/ViolationGroup.tsx`

This replaces the flat ViolationCard list. Each file becomes a collapsible section with compact violation rows that expand inline on click.

**Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Code,
  MessageSquare,
} from "lucide-react";

interface Violation {
  id: string;
  violation_id?: string;
  severity: "critical" | "high" | "medium";
  description: string;
  file: string;
  line: number;
  resource: string;
  explanation: string;
  regulation_citation: string;
  what_needs_to_change: string;
  estimated_effort: string;
  priority: string;
  sample_fix: string;
  approved: boolean;
}

interface ViolationGroupProps {
  file: string;
  violations: Violation[];
  approvedIds: Set<string>;
  onApprove: (id: string) => void;
  onAskAbout: (violation: Violation) => void;
}

const severityConfig = {
  critical: {
    label: "CRIT",
    badgeClass: "bg-red-100 text-red-700",
    dotColor: "bg-red-500",
  },
  high: {
    label: "HIGH",
    badgeClass: "bg-orange-100 text-orange-700",
    dotColor: "bg-orange-500",
  },
  medium: {
    label: "MED",
    badgeClass: "bg-yellow-100 text-yellow-700",
    dotColor: "bg-yellow-500",
  },
};

export default function ViolationGroup({
  file,
  violations,
  approvedIds,
  onApprove,
  onAskAbout,
}: ViolationGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const approvedCount = violations.filter((v) => approvedIds.has(v.id)).length;

  return (
    <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 overflow-hidden">
      {/* File header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-warm-grey-100 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-warm-grey-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-warm-grey-400" />
        )}
        <FileText className="h-4 w-4 text-warm-brown-500" />
        <span className="flex-1 text-sm font-medium text-warm-grey-900 truncate">
          {file}
        </span>
        <span className="text-xs text-warm-grey-500">
          {approvedCount}/{violations.length} approved
        </span>
        <span className="rounded-full bg-warm-grey-200 px-2 py-0.5 text-xs font-medium text-warm-grey-700">
          {violations.length}
        </span>
      </button>

      {/* Violation rows */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-warm-grey-200">
              {violations.map((v) => {
                const config =
                  severityConfig[v.severity] || severityConfig.medium;
                const isApproved = approvedIds.has(v.id);
                const isExpanded = expandedRow === v.id;

                return (
                  <div key={v.id} className="border-b border-warm-grey-100 last:border-b-0">
                    {/* Compact row */}
                    <button
                      onClick={() =>
                        setExpandedRow(isExpanded ? null : v.id)
                      }
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-warm-grey-100/50 transition-colors"
                    >
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${config.badgeClass}`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${config.dotColor}`}
                        />
                        {config.label}
                      </span>
                      <span className="flex-1 text-sm text-warm-grey-700 truncate">
                        {v.description}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onApprove(v.id);
                        }}
                        className={`flex-shrink-0 rounded-lg p-1 transition-colors ${
                          isApproved
                            ? "text-warm-brown-500"
                            : "text-warm-grey-300 hover:text-warm-grey-500"
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 pt-1 space-y-3 bg-white/50">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-warm-grey-500">
                              <span>Line {v.line}</span>
                              {v.resource && (
                                <span>
                                  Resource:{" "}
                                  <span className="text-warm-grey-700">
                                    {v.resource}
                                  </span>
                                </span>
                              )}
                              {v.estimated_effort && (
                                <span>
                                  Effort:{" "}
                                  <span className="text-warm-grey-700">
                                    {v.estimated_effort}
                                  </span>
                                </span>
                              )}
                              {v.priority && (
                                <span>
                                  Priority:{" "}
                                  <span className="text-warm-grey-700">
                                    {v.priority}
                                  </span>
                                </span>
                              )}
                            </div>

                            {v.explanation && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-warm-grey-400">
                                  What&apos;s Wrong
                                </p>
                                <p className="mt-1 text-sm text-warm-grey-700">
                                  {v.explanation}
                                </p>
                              </div>
                            )}

                            {v.regulation_citation && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-warm-grey-400">
                                  Regulation
                                </p>
                                <p className="mt-1 text-sm text-warm-grey-700 font-mono">
                                  {v.regulation_citation}
                                </p>
                              </div>
                            )}

                            {v.what_needs_to_change && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-warm-grey-400">
                                  Proposed Change
                                </p>
                                <p className="mt-1 text-sm text-warm-grey-700">
                                  {v.what_needs_to_change}
                                </p>
                              </div>
                            )}

                            {v.sample_fix && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-warm-grey-400">
                                  Sample Fix
                                </p>
                                <div className="mt-1 rounded-lg bg-warm-grey-900 p-3">
                                  <pre className="overflow-x-auto text-xs text-warm-grey-100 font-mono whitespace-pre-wrap">
                                    {v.sample_fix}
                                  </pre>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => onAskAbout(v)}
                                className="flex items-center gap-1.5 rounded-lg border border-warm-grey-300 bg-warm-grey-100 px-3 py-1.5 text-xs font-medium text-warm-grey-700 hover:bg-warm-grey-200 transition-colors"
                              >
                                <MessageSquare className="h-3 w-3" />
                                Ask about this
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add comply-landing/src/app/dashboard/components/ViolationGroup.tsx
git commit -m "feat: add ViolationGroup component with compact expandable rows"
```

---

### Task 6: Create ChatPanel component

**Files:**
- Create: `comply-landing/src/app/dashboard/components/ChatPanel.tsx`

**Step 1: Write the component**

```tsx
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
```

**Step 2: Commit**

```bash
git add comply-landing/src/app/dashboard/components/ChatPanel.tsx
git commit -m "feat: add ChatPanel component with SSE streaming"
```

---

### Task 7: Rewrite scan page with two-column layout and grouped violations

**Files:**
- Modify: `comply-landing/src/app/dashboard/scan/[id]/page.tsx` (full rewrite of the violations + layout sections)

This is the largest task. The key changes:

1. **Layout**: Two-column grid when scan is completed (`grid grid-cols-1 lg:grid-cols-5 gap-6`)
2. **Left column** (3/5): Header, Reasoning Trace, Filter chips, ViolationGroups
3. **Right column** (2/5): ChatPanel, sticky
4. **Filter state**: severity filter chips, sort option
5. **Group violations by file**: computed from the violations array
6. **"Ask about this" bridge**: prefill state passed from ViolationGroup to ChatPanel

**Step 1: Rewrite the scan page**

Replace the entire file content. The key structural changes from the current file:

- Add imports for `ViolationGroup` and `ChatPanel`
- Remove `ViolationCard` import
- Add state: `severityFilter`, `chatPrefill`
- Add `groupedViolations` computed value (group by file, apply filters)
- Change layout from single-column to `grid grid-cols-1 lg:grid-cols-5 gap-6`
- Replace the flat `violations.map(ViolationCard)` with filter bar + `groupedViolations.map(ViolationGroup)`
- Add ChatPanel in right column, only when scan is completed

The full rewritten file is large — here are the key sections that change. Keep all existing state, SSE logic, and handlers (lines 1-303) largely intact. The JSX (lines 307+) changes:

**New imports** (replace ViolationCard import):
```tsx
import ViolationGroup from "../../components/ViolationGroup";
import ChatPanel from "../../components/ChatPanel";
```

**New state** (add after existing state declarations around line 65):
```tsx
const [severityFilter, setSeverityFilter] = useState<string>("all");
const [chatPrefill, setChatPrefill] = useState<string | null>(null);
```

**Computed grouped violations** (add before the return statement):
```tsx
const filteredViolations =
  severityFilter === "all"
    ? violations
    : violations.filter((v) => v.severity === severityFilter);

const groupedByFile = filteredViolations.reduce<Record<string, typeof violations>>(
  (acc, v) => {
    const f = v.file || "unknown";
    (acc[f] ||= []).push(v);
    return acc;
  },
  {}
);
const fileGroups = Object.entries(groupedByFile);
```

**Two-column layout wrapper** (replaces the outer motion.div):
```tsx
<div className="space-y-6">
  {/* Back link + Header + Reasoning Trace — full width, unchanged */}

  {/* Two-column grid for violations + chat */}
  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
    {/* Left column: violations */}
    <div className="lg:col-span-3 space-y-4">
      {/* Filter bar */}
      {/* ViolationGroups */}
    </div>

    {/* Right column: chat (completed scans only) */}
    {scanStatus === "completed" && violations.length > 0 && (
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <ChatPanel
            scanId={scanId}
            prefillQuestion={chatPrefill}
            onPrefillConsumed={() => setChatPrefill(null)}
          />
        </div>
      </div>
    )}
  </div>
</div>
```

**Filter bar** (replaces the current violations header):
```tsx
<div className="flex flex-wrap items-center gap-2">
  {["all", "critical", "high", "medium"].map((sev) => (
    <button
      key={sev}
      onClick={() => setSeverityFilter(sev)}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        severityFilter === sev
          ? "bg-warm-brown-500 text-white"
          : "bg-warm-grey-100 text-warm-grey-600 hover:bg-warm-grey-200"
      }`}
    >
      {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
    </button>
  ))}
  <div className="ml-auto flex items-center gap-2">
    <span className="text-xs text-warm-grey-500">
      {approvedIds.size} of {violations.length} approved
    </span>
    <button onClick={handleApproveAll} className="rounded-xl bg-warm-brown-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-warm-brown-600 transition-colors">
      {approvedIds.size === violations.length ? "Deselect All" : "Approve All"}
    </button>
    <button onClick={handleCreatePRs} disabled={approvedIds.size === 0 || prLoading} className="rounded-xl bg-warm-brown-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-warm-brown-600 transition-colors disabled:opacity-50">
      {prLoading ? "Creating..." : "Create PRs"}
    </button>
  </div>
</div>
```

**ViolationGroups** (replaces the flat card list):
```tsx
{fileGroups.map(([file, viols]) => (
  <ViolationGroup
    key={file}
    file={file}
    violations={viols}
    approvedIds={approvedIds}
    onApprove={(id) => handleApprove(id)}
    onAskAbout={(v) =>
      setChatPrefill(
        `Explain the violation in ${v.file} line ${v.line}: ${v.description}`
      )
    }
  />
))}
```

**Step 2: Widen the layout container**

Modify: `comply-landing/src/app/dashboard/layout.tsx` — change `max-w-6xl` to `max-w-7xl` to accommodate the two-column layout.

**Step 3: Verify**

Run the Next.js dev server, navigate to a completed scan. Verify:
- Two-column layout appears on desktop
- Violations grouped by file with collapsible rows
- Filter chips work
- Chat panel shows starter prompts
- Sending a message streams a response
- "Ask about this" prefills the chat input

**Step 4: Commit**

```bash
git add comply-landing/src/app/dashboard/scan/[id]/page.tsx comply-landing/src/app/dashboard/layout.tsx
git commit -m "feat: two-column layout with grouped violations and chat panel"
```

---

### Task 8: Clean up

**Files:**
- Potentially delete: `comply-landing/src/app/dashboard/components/ViolationCard.tsx`

**Step 1: Check for other imports of ViolationCard**

Search for `ViolationCard` across the frontend. If the scan page was the only consumer, delete the file.

**Step 2: Commit**

```bash
git rm comply-landing/src/app/dashboard/components/ViolationCard.tsx
git commit -m "chore: remove unused ViolationCard component"
```
