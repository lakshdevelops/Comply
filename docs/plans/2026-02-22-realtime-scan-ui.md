# Real-Time Scan UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stream scan results in real-time via SSE so users see agent reasoning, violations, and plans appear live as the scan runs.

**Architecture:** `POST /scan` creates a DB record and returns immediately. The new `GET /scan/{id}/stream` SSE endpoint runs the LangGraph pipeline, streaming events as each agent yields reasoning chunks, violations, and plans. The frontend opens an EventSource on mount and renders results incrementally with typing effects.

**Tech Stack:** FastAPI StreamingResponse (SSE), google.generativeai streaming, Next.js EventSource, Framer Motion animations.

---

### Task 1: Add streaming to Gemini client

**Files:**
- Modify: `backend/app/agents/gemini_client.py`

**Step 1: Add `invoke_streaming` generator function**

Add this function after the existing `invoke` function:

```python
def invoke_streaming(system_prompt: str, user_content: str):
    """
    Call Gemini with streaming enabled.
    Yields text chunks as they arrive from the model.
    """
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=system_prompt,
    )
    response = model.generate_content(user_content, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text
```

**Step 2: Verify existing `invoke` still works unchanged**

Run backend: `cd backend && uvicorn app.main:app --port 8000`
Test: `curl http://localhost:8000/health` should return `{"status":"healthy"}`

**Step 3: Commit**

```bash
git add backend/app/agents/gemini_client.py
git commit -m "feat: add streaming support to Gemini client"
```

---

### Task 2: Refactor auditor to yield streaming events

**Files:**
- Modify: `backend/app/agents/auditor.py`

**Step 1: Add `run_auditor_streaming` generator**

Keep the existing `run_auditor` intact (used by QA rescan). Add a new generator function below it:

```python
def run_auditor_streaming(repo_files: dict[str, str]):
    """
    Generator that yields SSE-compatible event dicts as it scans files.

    Yields dicts with 'event' and 'data' keys:
      - {"event": "reasoning_chunk", "data": {"agent": "Auditor", "chunk": "..."}}
      - {"event": "violation_found", "data": {"agent": "Auditor", "violation": {...}}}
    """
    from app.agents.gemini_client import invoke_streaming, invoke

    rules = get_rules()
    ruleset_json = json.dumps(rules, indent=2)
    system_prompt = AUDITOR_SYSTEM_PROMPT.format(ruleset=ruleset_json)

    filenames = list(repo_files.keys())
    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Auditor", "chunk": f"Scanning {len(filenames)} infrastructure files...\n"}
    }

    # Build user content
    file_sections = []
    for filename, content in repo_files.items():
        file_sections.append(f"--- FILE: {filename} ---\n{content}\n")
        yield {
            "event": "reasoning_chunk",
            "data": {"agent": "Auditor", "chunk": f"Reading {filename}...\n"}
        }
    user_content = "\n".join(file_sections)

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Auditor", "chunk": "Analyzing files against compliance ruleset...\n"}
    }

    # Stream Gemini reasoning
    full_response = ""
    for chunk in invoke_streaming(system_prompt=system_prompt, user_content=user_content):
        full_response += chunk
        yield {
            "event": "reasoning_chunk",
            "data": {"agent": "Auditor", "chunk": chunk}
        }

    # Parse violations from complete response
    text = full_response.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]).strip()

    try:
        violations = json.loads(text)
    except json.JSONDecodeError:
        violations = []

    if isinstance(violations, list):
        for v in violations:
            if not v.get("violation_id"):
                v["violation_id"] = f"V-{uuid.uuid4().hex[:8]}"
            yield {
                "event": "violation_found",
                "data": {"agent": "Auditor", "violation": v}
            }
    else:
        violations = []

    # Yield final summary (returned for pipeline state)
    yield {
        "event": "agent_complete",
        "data": {"agent": "Auditor", "summary": f"{len(violations)} violations detected", "violations": violations}
    }
```

**Step 2: Commit**

```bash
git add backend/app/agents/auditor.py
git commit -m "feat: add streaming auditor generator"
```

---

### Task 3: Refactor strategist to yield streaming events

**Files:**
- Modify: `backend/app/agents/strategist.py`

**Step 1: Add `run_strategist_streaming` generator**

Keep existing `run_strategist` intact. Add below it:

```python
def run_strategist_streaming(violations: list[dict]):
    """
    Generator that yields SSE-compatible event dicts as it builds remediation plans.
    """
    from app.agents.gemini_client import invoke_streaming

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Strategist", "chunk": f"Building remediation plans for {len(violations)} violations...\n"}
    }

    # Enrich violations with regulatory context
    enriched = []
    for v in violations:
        entry = dict(v)
        regulation_ref = v.get("regulation_ref", "")
        if regulation_ref:
            context = get_article_context(regulation_ref)
            if context:
                entry["regulatory_context"] = context
            yield {
                "event": "reasoning_chunk",
                "data": {"agent": "Strategist", "chunk": f"Enriching violation {v.get('violation_id', '?')} with {regulation_ref} context...\n"}
            }
        enriched.append(entry)

    user_content = json.dumps(enriched, indent=2)

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Strategist", "chunk": "Generating remediation strategies...\n"}
    }

    # Stream Gemini reasoning
    full_response = ""
    for chunk in invoke_streaming(system_prompt=STRATEGIST_SYSTEM_PROMPT, user_content=user_content):
        full_response += chunk
        yield {
            "event": "reasoning_chunk",
            "data": {"agent": "Strategist", "chunk": chunk}
        }

    # Parse plans from complete response
    text = full_response.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]).strip()

    try:
        plans = json.loads(text)
    except json.JSONDecodeError:
        plans = []

    if not isinstance(plans, list):
        plans = []

    for p in plans:
        yield {
            "event": "plan_ready",
            "data": {"agent": "Strategist", "plan": p}
        }

    yield {
        "event": "agent_complete",
        "data": {"agent": "Strategist", "summary": f"{len(plans)} remediation plans produced", "plans": plans}
    }
```

**Step 2: Commit**

```bash
git add backend/app/agents/strategist.py
git commit -m "feat: add streaming strategist generator"
```

---

### Task 4: Add SSE stream endpoint

**Files:**
- Modify: `backend/app/routes/scan.py`

**Step 1: Make `POST /scan` lightweight**

Replace the current `trigger_scan` function body. Keep the scan record creation, but remove the pipeline execution. Return immediately after creating the DB record:

```python
@router.post("/scan")
def trigger_scan(req: ScanRequest, user: dict = Depends(get_current_user)):
    """Create a scan record. The pipeline runs via the SSE stream endpoint."""
    user_id = user["uid"]

    # Verify GitHub connected
    db = get_db()
    row = db.execute(
        "SELECT access_token FROM github_tokens WHERE user_id = ?", (user_id,)
    ).fetchone()
    db.close()
    if not row:
        raise HTTPException(status_code=400, detail="GitHub not connected.")

    # Create scan record
    scan_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = get_db()
    db.execute(
        "INSERT INTO scans (id, user_id, repo_url, repo_owner, repo_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (scan_id, user_id, f"{req.repo_owner}/{req.repo_name}", req.repo_owner, req.repo_name, "pending", now, now),
    )
    db.commit()
    db.close()

    return {"scan_id": scan_id}
```

**Step 2: Add the SSE stream endpoint**

Add these imports at top of `scan.py`:

```python
from fastapi import Query
from fastapi.responses import StreamingResponse
from app.core.security import _ensure_firebase_initialized
from firebase_admin import auth as firebase_auth
from app.agents.auditor import run_auditor_streaming
from app.agents.strategist import run_strategist_streaming
from app.services.github_service import get_repo_infra_files
import json
```

Add the endpoint:

```python
@router.get("/scan/{scan_id}/stream")
def stream_scan(scan_id: str, token: str = Query(...)):
    """SSE endpoint that runs the scan pipeline and streams events."""
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
        "SELECT * FROM scans WHERE id = ? AND user_id = ?", (scan_id, user_id)
    ).fetchone()
    if not scan:
        db.close()
        raise HTTPException(status_code=404, detail="Scan not found")

    # Get GitHub token
    gh_row = db.execute(
        "SELECT access_token FROM github_tokens WHERE user_id = ?", (user_id,)
    ).fetchone()
    db.close()
    if not gh_row:
        raise HTTPException(status_code=400, detail="GitHub not connected.")

    access_token = gh_row["access_token"]
    repo_owner = scan["repo_owner"]
    repo_name = scan["repo_name"]

    def event_generator():
        try:
            # Update status to scanning
            db = get_db()
            db.execute(
                "UPDATE scans SET status = 'scanning', updated_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), scan_id),
            )
            db.commit()
            db.close()

            # Fetch infra files
            yield format_sse("agent_start", {"agent": "Auditor", "message": "Fetching repository files..."})
            repo_files = get_repo_infra_files(access_token, repo_owner, repo_name)

            if not repo_files:
                yield format_sse("agent_complete", {"agent": "Auditor", "summary": "No infrastructure files found"})
                yield format_sse("scan_complete", {"scan_id": scan_id, "status": "completed"})
                db = get_db()
                db.execute(
                    "UPDATE scans SET status = 'completed', updated_at = ? WHERE id = ?",
                    (datetime.utcnow().isoformat(), scan_id),
                )
                db.commit()
                db.close()
                return

            # Run auditor (streaming)
            violations = []
            for event in run_auditor_streaming(repo_files):
                yield format_sse(event["event"], event["data"])
                if event["event"] == "agent_complete":
                    violations = event["data"].get("violations", [])

            # Save violations to DB
            db = get_db()
            for v in violations:
                vid = v.get("violation_id", str(uuid.uuid4()))
                db.execute(
                    "INSERT INTO violations (id, scan_id, rule_id, severity, file, line, resource, field, current_value, description, regulation_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (vid, scan_id, v.get("rule_id", ""), v.get("severity", "medium"), v.get("file", ""), v.get("line"), v.get("resource"), v.get("field"), v.get("current_value"), v.get("description", ""), v.get("regulation_ref", "")),
                )
            db.commit()
            db.close()

            # Run strategist (streaming)
            yield format_sse("agent_start", {"agent": "Strategist", "message": "Building remediation plans..."})
            plans = []
            for event in run_strategist_streaming(violations):
                yield format_sse(event["event"], event["data"])
                if event["event"] == "agent_complete":
                    plans = event["data"].get("plans", [])

            # Save plans to DB
            db = get_db()
            for p in plans:
                pid = str(uuid.uuid4())
                db.execute(
                    "INSERT INTO remediation_plans (id, scan_id, violation_id, explanation, regulation_citation, what_needs_to_change, sample_fix, estimated_effort, priority, file, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (pid, scan_id, p.get("violation_id", ""), p.get("explanation", ""), p.get("regulation_citation", ""), p.get("what_needs_to_change", ""), p.get("sample_fix"), p.get("estimated_effort"), p.get("priority", "P2"), p.get("file", ""), 0),
                )

            # Save reasoning log summary
            for agent_name, summary in [("Auditor", f"{len(violations)} violations detected"), ("Strategist", f"{len(plans)} remediation plans produced")]:
                db.execute(
                    "INSERT INTO reasoning_log (id, scan_id, agent, action, output, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), scan_id, agent_name, "scan" if agent_name == "Auditor" else "plan", summary, datetime.utcnow().isoformat()),
                )

            db.execute(
                "UPDATE scans SET status = 'completed', updated_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), scan_id),
            )
            db.commit()
            db.close()

            yield format_sse("scan_complete", {"scan_id": scan_id, "status": "completed"})

        except Exception as e:
            db = get_db()
            db.execute(
                "UPDATE scans SET status = 'failed', updated_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), scan_id),
            )
            db.commit()
            db.close()
            yield format_sse("scan_error", {"message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def format_sse(event: str, data: dict) -> str:
    """Format a dict as an SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
```

**Step 3: Commit**

```bash
git add backend/app/routes/scan.py
git commit -m "feat: add SSE stream endpoint and make POST /scan lightweight"
```

---

### Task 5: Update frontend API layer

**Files:**
- Modify: `comply-landing/src/lib/api.ts`

**Step 1: Update `triggerScan` return type expectation**

The `triggerScan` function already returns `{scan_id}` — no change needed.

**Step 2: Add `getScanStreamUrl` helper**

Add after the existing scan functions:

```typescript
export const getScanStreamUrl = (token: string, scanId: string) =>
  `${API_BASE}/scan/${scanId}/stream?token=${encodeURIComponent(token)}`;
```

**Step 3: Commit**

```bash
git add comply-landing/src/lib/api.ts
git commit -m "feat: add SSE stream URL helper to API layer"
```

---

### Task 6: Build the streaming scan page

**Files:**
- Rewrite: `comply-landing/src/app/dashboard/scan/[id]/page.tsx`

**Step 1: Replace the entire page component**

This is the core UI change. The new page:
- On mount, checks if scan is already completed (loads from GET API) or pending (opens SSE)
- Renders a two-section layout: Reasoning Trace (top) + Violations (bottom)
- Agent cards are collapsible with typing effect for reasoning
- Violations animate in one by one
- Action buttons appear only after scan_complete

The full component code:

```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Loader2,
  Bot,
  Scan,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getScan, getScanStreamUrl, approveFixes, createPRs } from "@/lib/api";
import ViolationCard from "../../components/ViolationCard";
import PrStatus from "../../components/PrStatus";

interface Violation {
  id: string;
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

interface AgentState {
  name: string;
  status: "pending" | "active" | "done";
  summary: string;
  reasoningChunks: string[];
}

type ScanStatus = "connecting" | "streaming" | "completed" | "failed";

export default function ScanResultPage() {
  const params = useParams();
  const scanId = params.id as string;
  const { getIdToken } = useAuth();

  const [scanStatus, setScanStatus] = useState<ScanStatus>("connecting");
  const [repoInfo, setRepoInfo] = useState({ owner: "", name: "", created_at: "" });
  const [agents, setAgents] = useState<AgentState[]>([
    { name: "Auditor", status: "pending", summary: "", reasoningChunks: [] },
    { name: "Strategist", status: "pending", summary: "", reasoningChunks: [] },
  ]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [plans, setPlans] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [prLoading, setPrLoading] = useState(false);
  const [prUrls, setPrUrls] = useState<string[]>([]);
  const [prError, setPrError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reasoningEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning into view
  useEffect(() => {
    if (scanStatus === "streaming") {
      reasoningEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [agents, scanStatus]);

  const updateAgent = useCallback((name: string, updater: (prev: AgentState) => AgentState) => {
    setAgents((prev) =>
      prev.map((a) => (a.name === name ? updater(a) : a))
    );
  }, []);

  // Load completed scan or start SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let cancelled = false;

    async function init() {
      const token = await getIdToken();
      if (!token || cancelled) return;

      // Check if scan already completed
      try {
        const data = await getScan(token, scanId);
        if (data.status === "completed" || data.status === "failed") {
          // Load from DB
          setRepoInfo({
            owner: data.repo_owner,
            name: data.repo_name,
            created_at: data.created_at,
          });
          setScanStatus(data.status);

          // Populate agents from reasoning log
          const log = data.reasoning_log || [];
          setAgents((prev) =>
            prev.map((a) => {
              const entry = log.find((l: { agent: string }) => l.agent === a.name);
              return entry
                ? { ...a, status: "done" as const, summary: entry.output }
                : a;
            })
          );

          // Populate violations with plan data merged
          const planMap = new Map<string, Record<string, unknown>>();
          for (const p of data.remediation_plans || []) {
            planMap.set(p.violation_id, p);
          }
          setPlans(planMap);

          const viols = (data.violations || []).map((v: Record<string, unknown>) => {
            const plan = planMap.get(v.id as string) || {};
            return { ...v, ...plan };
          });
          setViolations(viols);

          const approved = new Set<string>(
            viols.filter((v: Violation) => v.approved).map((v: Violation) => v.id)
          );
          setApprovedIds(approved);
          if (data.pr_urls) setPrUrls(data.pr_urls);
          return;
        }
      } catch {
        // Scan might be pending (just created), proceed to SSE
      }

      // Open SSE connection
      setScanStatus("streaming");
      const url = getScanStreamUrl(token, scanId);
      eventSource = new EventSource(url);

      eventSource.addEventListener("agent_start", (e) => {
        const data = JSON.parse(e.data);
        updateAgent(data.agent, (a) => ({
          ...a,
          status: "active",
          reasoningChunks: [...a.reasoningChunks, data.message + "\n"],
        }));
        setExpandedAgent(data.agent);
      });

      eventSource.addEventListener("reasoning_chunk", (e) => {
        const data = JSON.parse(e.data);
        updateAgent(data.agent, (a) => ({
          ...a,
          reasoningChunks: [...a.reasoningChunks, data.chunk],
        }));
      });

      eventSource.addEventListener("violation_found", (e) => {
        const data = JSON.parse(e.data);
        setViolations((prev) => [...prev, data.violation]);
      });

      eventSource.addEventListener("plan_ready", (e) => {
        const data = JSON.parse(e.data);
        const plan = data.plan;
        setPlans((prev) => {
          const next = new Map(prev);
          next.set(plan.violation_id, plan);
          return next;
        });
        // Merge plan data into matching violation
        setViolations((prev) =>
          prev.map((v) =>
            v.id === plan.violation_id || (v as Record<string, unknown>).violation_id === plan.violation_id
              ? { ...v, ...plan }
              : v
          )
        );
      });

      eventSource.addEventListener("agent_complete", (e) => {
        const data = JSON.parse(e.data);
        updateAgent(data.agent, (a) => ({
          ...a,
          status: "done",
          summary: data.summary,
        }));
      });

      eventSource.addEventListener("scan_complete", (e) => {
        const data = JSON.parse(e.data);
        // Fetch repo info
        getScan(token, scanId).then((full) => {
          setRepoInfo({
            owner: full.repo_owner,
            name: full.repo_name,
            created_at: full.created_at,
          });
        }).catch(() => {});
        setScanStatus(data.status);
        eventSource?.close();
      });

      eventSource.addEventListener("scan_error", (e) => {
        const data = JSON.parse(e.data);
        setError(data.message);
        setScanStatus("failed");
        eventSource?.close();
      });

      eventSource.onerror = () => {
        if (scanStatus !== "completed") {
          setError("Connection lost. Refresh to check scan status.");
          setScanStatus("failed");
        }
        eventSource?.close();
      };
    }

    init();

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, [scanId, getIdToken, updateAgent]);

  // Fetch repo info for streaming scans
  useEffect(() => {
    if (repoInfo.owner) return;
    async function fetchInfo() {
      const token = await getIdToken();
      if (!token) return;
      try {
        const data = await getScan(token, scanId);
        setRepoInfo({
          owner: data.repo_owner,
          name: data.repo_name,
          created_at: data.created_at,
        });
      } catch { /* ignore */ }
    }
    fetchInfo();
  }, [scanId, getIdToken, repoInfo.owner]);

  const handleApprove = async (violationId: string) => {
    const token = await getIdToken();
    if (!token) return;
    const newApproved = new Set(approvedIds);
    if (newApproved.has(violationId)) {
      newApproved.delete(violationId);
    } else {
      newApproved.add(violationId);
    }
    setApprovedIds(newApproved);
    try {
      await approveFixes(token, scanId, Array.from(newApproved));
    } catch {
      setApprovedIds(approvedIds);
    }
  };

  const handleApproveAll = async () => {
    const token = await getIdToken();
    if (!token) return;
    const allIds = new Set(violations.map((v) => v.id));
    setApprovedIds(allIds);
    try {
      await approveFixes(token, scanId, Array.from(allIds));
    } catch {
      setApprovedIds(approvedIds);
    }
  };

  const handleCreatePRs = async () => {
    const token = await getIdToken();
    if (!token) return;
    setPrLoading(true);
    setPrError(null);
    try {
      const result = await createPRs(token, scanId);
      setPrUrls(result.pr_urls || []);
    } catch (err) {
      setPrError(err instanceof Error ? err.message : "Failed to create pull requests");
    } finally {
      setPrLoading(false);
    }
  };

  const isStreaming = scanStatus === "streaming" || scanStatus === "connecting";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-warm-grey-500 hover:text-warm-grey-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-warm-grey-900">
              {repoInfo.owner && repoInfo.name
                ? `${repoInfo.owner}/${repoInfo.name}`
                : "Loading..."}
            </h1>
            {repoInfo.created_at && (
              <p className="mt-1 text-sm text-warm-grey-600">
                Scanned on{" "}
                {new Date(repoInfo.created_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {scanStatus === "completed" && <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />}
            {scanStatus === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
            {isStreaming && <Loader2 className="h-5 w-5 text-warm-brown-500 animate-spin" />}
            <span className="text-sm font-medium capitalize text-warm-grey-800">
              {scanStatus === "connecting" ? "Starting..." : scanStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Reasoning Trace */}
      <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
        <h3 className="font-display text-lg font-bold text-warm-grey-900">
          Reasoning Trace
        </h3>
        <p className="mt-1 text-sm text-warm-grey-600">
          Live chain-of-thought from compliance agents.
        </p>

        <div className="mt-5 space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="rounded-xl border border-warm-grey-200 bg-white overflow-hidden"
            >
              {/* Agent header - always visible */}
              <button
                onClick={() =>
                  setExpandedAgent(expandedAgent === agent.name ? null : agent.name)
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-warm-grey-50 transition-colors"
              >
                <div className="flex-shrink-0">
                  {agent.status === "active" && (
                    <Loader2 className="h-5 w-5 text-warm-brown-500 animate-spin" />
                  )}
                  {agent.status === "done" && (
                    <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />
                  )}
                  {agent.status === "pending" && (
                    <Bot className="h-5 w-5 text-warm-grey-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-warm-grey-900">
                    {agent.name}
                  </span>
                  {agent.summary && (
                    <span className="ml-2 text-xs text-warm-grey-500">
                      — {agent.summary}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-warm-grey-400 transition-transform ${
                    expandedAgent === agent.name ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded reasoning */}
              <AnimatePresence>
                {expandedAgent === agent.name && agent.reasoningChunks.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-warm-grey-200 bg-warm-grey-900 px-4 py-3 max-h-80 overflow-y-auto">
                      <pre className="text-xs text-warm-grey-100 font-mono whitespace-pre-wrap leading-relaxed">
                        {agent.reasoningChunks.join("")}
                        {agent.status === "active" && (
                          <span className="inline-block w-2 h-4 bg-warm-brown-400 animate-pulse ml-0.5 align-middle" />
                        )}
                      </pre>
                      <div ref={expandedAgent === agent.name ? reasoningEndRef : null} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-warm-grey-900">
              Violations ({violations.length})
            </h2>
            {scanStatus === "completed" && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-warm-grey-500">
                  {approvedIds.size} of {violations.length} approved
                </span>
                <button
                  onClick={handleApproveAll}
                  className="rounded-xl bg-warm-brown-500 px-4 py-2 text-sm font-medium text-white hover:bg-warm-brown-600 transition-colors"
                >
                  Approve All
                </button>
                <button
                  onClick={handleCreatePRs}
                  disabled={approvedIds.size === 0 || prLoading}
                  className="rounded-xl bg-warm-brown-500 px-4 py-2 text-sm font-medium text-white hover:bg-warm-brown-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {prLoading ? "Creating PRs..." : "Create PRs"}
                </button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {violations.map((violation) => (
              <motion.div
                key={violation.id || (violation as Record<string, unknown>).violation_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ViolationCard
                  violation={violation}
                  isApproved={approvedIds.has(violation.id)}
                  onApprove={() => handleApprove(violation.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Streaming empty state */}
      {isStreaming && violations.length === 0 && (
        <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-12 text-center">
          <Scan className="mx-auto h-8 w-8 text-warm-brown-400 animate-pulse" />
          <p className="mt-3 text-sm text-warm-grey-500">
            Scanning for compliance violations...
          </p>
        </div>
      )}

      {/* Completed empty state */}
      {scanStatus === "completed" && violations.length === 0 && (
        <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-warm-brown-500" />
          <h3 className="mt-3 font-display text-lg font-bold text-warm-grey-900">
            All Clear
          </h3>
          <p className="mt-1 text-sm text-warm-grey-600">
            No compliance violations were found in this repository.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* PR Status */}
      {(prUrls.length > 0 || prLoading || prError) && (
        <PrStatus urls={prUrls} loading={prLoading} error={prError} />
      )}
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add comply-landing/src/app/dashboard/scan/[id]/page.tsx
git commit -m "feat: rebuild scan page with real-time SSE streaming UI"
```

---

### Task 7: Remove unused ScanProgress component

**Files:**
- Delete: `comply-landing/src/app/dashboard/components/ScanProgress.tsx`

The old ScanProgress component is no longer imported. The reasoning trace is now built into the scan page itself.

**Step 1: Delete the file**

```bash
rm comply-landing/src/app/dashboard/components/ScanProgress.tsx
```

**Step 2: Commit**

```bash
git add -A comply-landing/src/app/dashboard/components/ScanProgress.tsx
git commit -m "chore: remove unused ScanProgress component"
```

---

### Task 8: Integration test — full scan flow

**Step 1: Start backend**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

**Step 2: Start frontend**

```bash
cd comply-landing && npm run dev
```

**Step 3: Manual test flow**

1. Navigate to dashboard
2. Select a repo from dropdown
3. Click "Scan Repository" — should navigate to scan page immediately
4. Verify: Auditor agent card shows "active" with spinning indicator
5. Verify: Reasoning text streams in with blinking cursor
6. Verify: Violations appear one by one as they're found
7. Verify: Strategist activates after Auditor completes
8. Verify: Plans attach to violation cards
9. Verify: After scan_complete, Approve/Create PRs buttons appear
10. Navigate back to dashboard, click the scan from history — should load completed state from DB (no SSE)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: real-time scan UI with SSE streaming"
```
