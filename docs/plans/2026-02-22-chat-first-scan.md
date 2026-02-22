# Chat-First Scan Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the two-column scan page with a single centered chat timeline where agent reasoning, violations, user chat, and PR creation all appear as messages in one continuous narrative.

**Architecture:** A unified message list model drives the scan page. SSE events from the scan and PR pipelines push typed messages into the list. Each message type renders a distinct component (agent card, violations widget, chat bubble, PR status). On revisit, the message list is reconstructed from DB data.

**Tech Stack:** Next.js 16 / React 19, Tailwind v4 (warm-grey/warm-brown theme), motion (Framer Motion), lucide-react, FastAPI SSE streaming, LangGraph, Gemini via google.generativeai.

**Design doc:** `docs/plans/2026-02-22-chat-first-scan-design.md`

---

### Task 1: Add streaming variant for code generator

**Files:**
- Modify: `backend/app/agents/code_generator.py`

The code generator currently uses `invoke()` (blocking). We need a streaming variant that yields SSE event dicts, following the same pattern as `run_auditor_streaming` and `run_strategist_streaming`.

**Step 1: Add the streaming function**

Append after the existing `run_code_generator` function:

```python
def run_code_generator_streaming(file_path: str, original_content: str, plans: list[dict]):
    """
    Generator that yields SSE-compatible event dicts as it generates fixes.
    """
    from app.agents.gemini_client import invoke_streaming

    plans_json = json.dumps(plans, indent=2)
    user_content = (
        f"FILE: {file_path}\n\n"
        f"ORIGINAL CONTENT:\n{original_content}\n\n"
        f"APPROVED REMEDIATION PLANS:\n{plans_json}"
    )

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Code Generator", "chunk": f"Generating fixes for {file_path}...\n"}
    }

    full_response = ""
    for chunk in invoke_streaming(system_prompt=CODE_GENERATOR_SYSTEM_PROMPT, user_content=user_content):
        full_response += chunk
        yield {
            "event": "reasoning_chunk",
            "data": {"agent": "Code Generator", "chunk": chunk}
        }

    yield {
        "event": "file_fixed",
        "data": {"agent": "Code Generator", "file": file_path, "fixed_content": full_response}
    }
```

**Step 2: Verify syntax**

Run: `python3 -c "import py_compile; py_compile.compile('app/agents/code_generator.py', doraise=True); print('OK')"`
Expected: OK

**Step 3: Commit**

```bash
git add backend/app/agents/code_generator.py
git commit -m "feat: add streaming variant for code generator"
```

---

### Task 2: Create SSE streaming endpoint for PR pipeline

**Files:**
- Modify: `backend/app/routes/fixes.py`

Add a new `GET /fixes/create-prs/stream` SSE endpoint that runs the PR pipeline and emits agent events at each node boundary. This replaces the blocking POST for the chat-first UI.

**Step 1: Add the streaming endpoint**

Add after the existing `create_prs` function. The endpoint walks through the pipeline steps manually (not via LangGraph `invoke`) so we can emit SSE events between nodes:

```python
@router.get("/fixes/create-prs/stream")
def stream_create_prs(scan_id: str = Query(...), token: str = Query(...)):
    """SSE endpoint that streams PR pipeline agent events."""
    from app.core.security import _ensure_firebase_initialized
    from firebase_admin import auth as firebase_auth
    from app.agents.code_generator import run_code_generator_streaming
    from app.agents.auditor import run_auditor_streaming, run_auditor
    from app.agents.strategist import run_strategist_streaming
    from app.services.github_service import get_repo_infra_files, create_pr

    _ensure_firebase_initialized()
    try:
        user = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    user_id = user["uid"]
    db = get_db()

    scan = db.execute(
        "SELECT * FROM scans WHERE id = ? AND user_id = ?", (scan_id, user_id)
    ).fetchone()
    if not scan:
        db.close()
        raise HTTPException(status_code=404, detail="Scan not found")

    token_row = db.execute(
        "SELECT access_token FROM github_tokens WHERE user_id = ?", (user_id,)
    ).fetchone()
    if not token_row:
        db.close()
        raise HTTPException(status_code=400, detail="GitHub not connected")

    access_token = token_row["access_token"]

    approved_plans = [
        dict(row) for row in db.execute(
            "SELECT rp.*, v.file as v_file FROM remediation_plans rp JOIN violations v ON rp.violation_id = v.id WHERE rp.scan_id = ? AND rp.approved = 1",
            (scan_id,),
        ).fetchall()
    ]

    if not approved_plans:
        db.close()
        raise HTTPException(status_code=400, detail="No approved fixes to generate PRs for")

    repo_files = get_repo_infra_files(access_token, scan["repo_owner"], scan["repo_name"])
    db.close()

    def format_sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    def event_generator():
        reasoning_traces: dict[str, list[str]] = {}
        current_files = dict(repo_files)
        current_plans = list(approved_plans)
        all_fixes: dict[str, dict] = {}
        qa_history = []

        try:
            for iteration in range(3):
                # --- Code Generator ---
                yield format_sse("agent_start", {"agent": "Code Generator", "message": f"Generating fixes (iteration {iteration + 1})..."})
                reasoning_traces.setdefault("Code Generator", []).append(f"Generating fixes (iteration {iteration + 1})...\n")

                plans_by_file: dict[str, list] = {}
                for plan in current_plans:
                    plans_by_file.setdefault(plan.get("v_file") or plan.get("file", ""), []).append(plan)

                files_fixed = 0
                for file_path, file_plans in plans_by_file.items():
                    original = current_files.get(file_path, "")
                    for event in run_code_generator_streaming(file_path, original, file_plans):
                        yield format_sse(event["event"], event["data"])
                        if event["event"] == "reasoning_chunk":
                            reasoning_traces.setdefault("Code Generator", []).append(event["data"].get("chunk", ""))
                        if event["event"] == "file_fixed":
                            fixed_content = event["data"]["fixed_content"]
                            current_files[file_path] = fixed_content
                            if file_path in all_fixes:
                                all_fixes[file_path]["fixed_content"] = fixed_content
                            else:
                                all_fixes[file_path] = {
                                    "file": file_path,
                                    "original_content": original,
                                    "fixed_content": fixed_content,
                                }
                            files_fixed += 1

                yield format_sse("agent_complete", {"agent": "Code Generator", "summary": f"{files_fixed} files modified"})

                # --- QA Re-scan ---
                yield format_sse("agent_start", {"agent": "QA Re-scan", "message": f"Re-scanning for new violations (iteration {iteration + 1})..."})
                reasoning_traces.setdefault("QA Re-scan", []).append(f"Re-scanning (iteration {iteration + 1})...\n")

                new_violations = run_auditor(current_files, is_qa_rescan=True)
                is_clean = len(new_violations) == 0

                qa_history.append({
                    "iteration": iteration + 1,
                    "violations": new_violations,
                    "is_clean": is_clean,
                })

                if is_clean:
                    yield format_sse("agent_complete", {"agent": "QA Re-scan", "summary": "CLEAN — no new violations"})
                    break
                else:
                    yield format_sse("agent_complete", {"agent": "QA Re-scan", "summary": f"{len(new_violations)} new violations found"})

                if iteration >= 2:
                    break

                # --- Strategist Replan ---
                yield format_sse("agent_start", {"agent": "Strategist (Replan)", "message": "Generating new remediation plans..."})
                reasoning_traces.setdefault("Strategist (Replan)", []).append("Replanning...\n")

                new_plans = []
                for event in run_strategist_streaming(new_violations):
                    yield format_sse(event["event"], event["data"])
                    if event["event"] == "reasoning_chunk":
                        reasoning_traces.setdefault("Strategist (Replan)", []).append(event["data"].get("chunk", ""))
                    if event["event"] == "agent_complete":
                        new_plans = event["data"].get("plans", [])

                current_plans = new_plans

            # Create PR
            file_fixes = [{"file": f["file"], "fixed_content": f["fixed_content"]} for f in all_fixes.values()]
            pr_result = create_pr(access_token, scan["repo_owner"], scan["repo_name"], file_fixes, approved_plans)

            # Save to DB
            db = get_db()
            db.execute(
                "INSERT INTO pull_requests (id, scan_id, pr_url, file, violation_count, branch_name) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), scan_id, pr_result["pr_url"], ",".join(f["file"] for f in file_fixes), len(approved_plans), pr_result["branch"]),
            )

            for entry in qa_history:
                db.execute(
                    "INSERT INTO qa_results (id, scan_id, iteration, is_clean, new_violations_json) VALUES (?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), scan_id, entry["iteration"], 1 if entry["is_clean"] else 0, json.dumps(entry["violations"])),
                )

            for agent_name, chunks in reasoning_traces.items():
                db.execute(
                    "INSERT INTO reasoning_log (id, scan_id, agent, action, output, full_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), scan_id, agent_name, "pr_pipeline", "", "".join(chunks) or None, datetime.utcnow().isoformat()),
                )

            db.commit()
            db.close()

            yield format_sse("pr_complete", {
                "pr_url": pr_result["pr_url"],
                "branch": pr_result["branch"],
                "violation_count": len(approved_plans),
                "qa_iterations": len(qa_history),
            })

        except Exception as e:
            yield format_sse("pr_error", {"message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

Note: Add these imports at the top of fixes.py if not already present:
```python
from fastapi import Query
from fastapi.responses import StreamingResponse
```

**Step 2: Verify syntax**

Run: `python3 -c "import py_compile; py_compile.compile('app/routes/fixes.py', doraise=True); print('OK')"`
Expected: OK

**Step 3: Commit**

```bash
git add backend/app/routes/fixes.py
git commit -m "feat: add SSE streaming endpoint for PR pipeline"
```

---

### Task 3: Add frontend API helper for PR streaming

**Files:**
- Modify: `comply-landing/src/lib/api.ts`

**Step 1: Add the helper**

Append after the existing `createPRs` function (line 85):

```typescript
export const getPRStreamUrl = (token: string, scanId: string) =>
  `${API_BASE}/fixes/create-prs/stream?scan_id=${encodeURIComponent(scanId)}&token=${encodeURIComponent(token)}`;
```

**Step 2: Commit**

```bash
git add comply-landing/src/lib/api.ts
git commit -m "feat: add PR stream URL helper"
```

---

### Task 4: Create AgentReasoningCard component

**Files:**
- Create: `comply-landing/src/app/dashboard/components/AgentReasoningCard.tsx`

A collapsible card that shows an agent's name, streaming reasoning text, and result summary. Used for Auditor, Strategist, Code Generator, QA Re-scan.

**Step 1: Write the component**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Bot,
} from "lucide-react";

interface AgentReasoningCardProps {
  agent: string;
  status: "active" | "done";
  reasoningChunks: string[];
  summary: string;
  defaultExpanded?: boolean;
}

export default function AgentReasoningCard({
  agent,
  status,
  reasoningChunks,
  summary,
  defaultExpanded = false,
}: AgentReasoningCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || status === "active");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand when agent becomes active
  useEffect(() => {
    if (status === "active") setExpanded(true);
  }, [status]);

  // Auto-scroll reasoning
  useEffect(() => {
    if (expanded && status === "active" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reasoningChunks, expanded, status]);

  return (
    <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 overflow-hidden">
      {/* Header */}
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

      {/* Reasoning content */}
      <AnimatePresence>
        {expanded && reasoningChunks.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="border-t border-warm-grey-200 bg-warm-grey-900 px-4 py-3 max-h-80 overflow-y-auto"
            >
              <pre className="text-xs text-warm-grey-100 font-mono whitespace-pre-wrap leading-relaxed">
                {reasoningChunks.join("")}
                {status === "active" && (
                  <span className="inline-block w-2 h-4 bg-warm-brown-400 animate-pulse ml-0.5 align-middle" />
                )}
              </pre>
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
git add comply-landing/src/app/dashboard/components/AgentReasoningCard.tsx
git commit -m "feat: add AgentReasoningCard component"
```

---

### Task 5: Create ViolationsWidget component

**Files:**
- Create: `comply-landing/src/app/dashboard/components/ViolationsWidget.tsx`

An in-chat widget that wraps the existing ViolationGroup with severity filter chips and action buttons (Approve All, Create PRs). Rendered as a message in the chat timeline.

**Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import ViolationGroup from "./ViolationGroup";

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

interface ViolationsWidgetProps {
  violations: Violation[];
  approvedIds: Set<string>;
  onApprove: (id: string) => void;
  onApproveAll: () => void;
  onCreatePRs: () => void;
  onAskAbout: (violation: Violation) => void;
  prLoading: boolean;
  isStreaming: boolean;
}

export default function ViolationsWidget({
  violations,
  approvedIds,
  onApprove,
  onApproveAll,
  onCreatePRs,
  onAskAbout,
  prLoading,
  isStreaming,
}: ViolationsWidgetProps) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const filteredViolations =
    severityFilter === "all"
      ? violations
      : violations.filter((v) => v.severity === severityFilter);

  const groupedByFile = filteredViolations.reduce<Record<string, Violation[]>>(
    (acc, v) => {
      const f = v.file || "unknown";
      (acc[f] ||= []).push(v);
      return acc;
    },
    {}
  );
  const fileGroups = Object.entries(groupedByFile);

  return (
    <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-4 space-y-3">
      {/* Filter bar + actions */}
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
            {sev === "all"
              ? `All (${violations.length})`
              : sev.charAt(0).toUpperCase() + sev.slice(1)}
          </button>
        ))}
        {!isStreaming && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-warm-grey-500">
              {approvedIds.size} of {violations.length} approved
            </span>
            <button
              onClick={onApproveAll}
              className="rounded-xl bg-warm-brown-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-warm-brown-600 transition-colors"
            >
              {approvedIds.size === violations.length
                ? "Deselect All"
                : "Approve All"}
            </button>
            <button
              onClick={onCreatePRs}
              disabled={approvedIds.size === 0 || prLoading}
              className="rounded-xl bg-warm-brown-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-warm-brown-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prLoading ? "Creating..." : "Create PRs"}
            </button>
          </div>
        )}
      </div>

      {/* Grouped violations */}
      <div className="space-y-3">
        {fileGroups.map(([file, viols]) => (
          <ViolationGroup
            key={file}
            file={file}
            violations={viols}
            approvedIds={approvedIds}
            onApprove={onApprove}
            onAskAbout={onAskAbout}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add comply-landing/src/app/dashboard/components/ViolationsWidget.tsx
git commit -m "feat: add ViolationsWidget component for in-chat violations"
```

---

### Task 6: Create PRStatusCard component

**Files:**
- Create: `comply-landing/src/app/dashboard/components/PRStatusCard.tsx`

A compact card showing the PR result: link, branch, violation count, QA iterations.

**Step 1: Write the component**

```tsx
"use client";

import { GitPullRequest, ExternalLink, CheckCircle2 } from "lucide-react";

interface PRStatusCardProps {
  prUrl: string;
  branch: string;
  violationCount: number;
  qaIterations: number;
}

export default function PRStatusCard({
  prUrl,
  branch,
  violationCount,
  qaIterations,
}: PRStatusCardProps) {
  return (
    <div className="rounded-2xl border border-warm-brown-200 bg-warm-brown-50/50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />
        <span className="text-sm font-medium text-warm-grey-900">
          Pull Request Created
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-warm-grey-500">
        <span>
          Branch: <span className="text-warm-grey-700 font-mono">{branch}</span>
        </span>
        <span>
          {violationCount} violation{violationCount !== 1 ? "s" : ""} resolved
        </span>
        <span>
          QA: Clean after {qaIterations} iteration{qaIterations !== 1 ? "s" : ""}
        </span>
      </div>

      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-warm-brown-200 bg-white px-4 py-2.5 text-sm font-medium text-warm-brown-700 hover:bg-warm-brown-50 transition-colors"
      >
        <GitPullRequest className="h-4 w-4" />
        <span className="truncate">View on GitHub</span>
        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
      </a>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add comply-landing/src/app/dashboard/components/PRStatusCard.tsx
git commit -m "feat: add PRStatusCard component"
```

---

### Task 7: Rewrite scan page with unified chat timeline

**Files:**
- Modify: `comply-landing/src/app/dashboard/scan/[id]/page.tsx` (full rewrite)

This is the largest task. The page becomes a single centered chat column with a message list model. SSE events push typed messages into the list. Each message type renders its corresponding component.

**Step 1: Rewrite the scan page**

The full rewritten file. Key structural changes from the current version:

- Replace `ViolationGroup` and `ChatPanel` imports with `AgentReasoningCard`, `ViolationsWidget`, `PRStatusCard`
- Replace separate state variables (`agents`, `expandedAgent`, `severityFilter`, `chatPrefill`) with a unified `messages` array
- Keep `violations`, `approvedIds`, `plans` state for data management
- SSE handlers push messages into the messages array instead of updating agent state
- The JSX is a single centered column that maps over messages
- Chat input at the bottom, enabled only after scan completes
- PR creation opens a new EventSource to the PR stream endpoint

The message type system:

```tsx
type TimelineMessage =
  | { type: "agent"; id: string; agent: string; status: "active" | "done"; reasoningChunks: string[]; summary: string }
  | { type: "violations" }
  | { type: "user"; content: string }
  | { type: "assistant"; id: string; content: string }
  | { type: "pr_status"; prUrl: string; branch: string; violationCount: number; qaIterations: number }
  | { type: "pr_loading" };
```

SSE event mapping:
- `agent_start` → append `{type: "agent", status: "active", ...}`
- `reasoning_chunk` → update last agent message's `reasoningChunks`
- `violation_found` → accumulate into `violations` state (no message)
- `plan_ready` → merge plan into matching violation (no message)
- `agent_complete` → mark last agent message as `done`, set summary
- `scan_complete` → append `{type: "violations"}`, enable chat input

PR SSE event mapping:
- `agent_start/reasoning_chunk/agent_complete` → same as scan SSE
- `pr_complete` → replace `{type: "pr_loading"}` with `{type: "pr_status"}`

Chat:
- User sends question → append `{type: "user"}`, append `{type: "assistant"}`, stream chunks
- On revisit: load chat_messages from DB, interleave with agent cards

Revisit reconstruction:
1. Reasoning log entries → collapsed agent cards
2. Violations + plans → violations widget message
3. Chat messages → user/assistant messages
4. Pull requests → PR status card
5. PR reasoning log entries → collapsed agent cards

**Important implementation details:**

- Use `useCallback` with `setMessages` functional updater to avoid stale closures in SSE handlers
- The violations widget message at `{type: "violations"}` doesn't carry data — it reads from the `violations` and `approvedIds` state directly
- `handleCreatePRs` opens an EventSource to `getPRStreamUrl()` instead of calling `createPRs()`
- Chat input uses the existing `getChatStreamUrl` for advisor streaming
- Auto-scroll the timeline container on new messages
- Starter prompts (from ChatPanel) appear below the violations widget when chat is first available

**Step 2: Revert layout width**

Modify `comply-landing/src/app/dashboard/layout.tsx` — change `max-w-7xl` back to `max-w-6xl` in both the main and header elements. The single-column chat no longer needs the extra width.

**Step 3: Verify build**

Run: `cd comply-landing && npx next build`
Expected: Build succeeds with no TypeScript errors

**Step 4: Commit**

```bash
git add comply-landing/src/app/dashboard/scan/[id]/page.tsx comply-landing/src/app/dashboard/layout.tsx
git commit -m "feat: rewrite scan page as unified chat timeline"
```

---

### Task 8: Clean up removed components

**Files:**
- Delete: `comply-landing/src/app/dashboard/components/ChatPanel.tsx`
- Delete: `comply-landing/src/app/dashboard/components/PrStatus.tsx`

**Step 1: Verify no remaining imports**

Search for `ChatPanel` and `PrStatus` across the frontend. If the scan page was the only consumer (it should be after the Task 7 rewrite), delete both files.

**Step 2: Commit**

```bash
git rm comply-landing/src/app/dashboard/components/ChatPanel.tsx comply-landing/src/app/dashboard/components/PrStatus.tsx
git commit -m "chore: remove ChatPanel and PrStatus (absorbed into chat timeline)"
```

---

### Task 9: Verify end-to-end

**Step 1: Start backend**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`

**Step 2: Start frontend**

Run: `cd comply-landing && npm run dev`

**Step 3: Test scan streaming**

Navigate to dashboard, trigger a new scan. Verify:
- Auditor reasoning card appears and streams
- Strategist reasoning card appears and streams
- Violations widget drops in after Strategist completes
- Chat input enables with starter prompts
- Sending a message streams advisor response

**Step 4: Test PR creation**

Approve violations, click Create PRs. Verify:
- Code Generator reasoning card appears and streams
- QA Re-scan card appears
- If dirty: Strategist Replan + Code Generator loop visible
- PR Status card appears with GitHub link

**Step 5: Test revisit**

Refresh the page. Verify:
- Agent cards load collapsed with stored reasoning
- Violations widget shows with current approval state
- Chat history loads
- PR status shows if PR was created
