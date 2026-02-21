# Real-Time Scan UI with SSE Streaming

**Date:** 2026-02-22
**Branch:** feature/dashboard-scan-ui

## Problem

The current scan page loads results only after the full pipeline completes. Users see no agent reasoning, no progress during scanning, and the reasoning log shows only terse summaries. The experience feels like a black box.

## Solution

Stream scan results in real-time via Server-Sent Events (SSE). Users see agent reasoning appear character-by-character as the scan runs, violations animate in one by one, and remediation plans attach incrementally.

## Architecture

### Backend

**Endpoint changes:**

- `POST /scan` becomes lightweight: creates DB record, returns `{scan_id}` immediately. Does NOT run the pipeline.
- `GET /scan/{scan_id}/stream?token=...` (new): SSE endpoint that runs the LangGraph pipeline and streams events. Token passed as query param since EventSource can't set headers.

**SSE event types:**

| Event | Data | When |
|---|---|---|
| `agent_start` | `{agent, message}` | Agent begins work |
| `reasoning_chunk` | `{agent, chunk}` | Streaming text from agent reasoning |
| `violation_found` | `{agent, violation}` | Each violation as parsed |
| `agent_complete` | `{agent, summary}` | Agent finishes |
| `plan_ready` | `{agent, plan}` | Each remediation plan as produced |
| `scan_complete` | `{scan_id, status}` | Pipeline done |
| `scan_error` | `{message}` | Pipeline failed |

**Agent refactoring:**

- `gemini_client.py` gets `invoke_streaming()` using `generate_content(stream=True)` to yield text chunks.
- `run_auditor` becomes a generator: processes files one by one, yields reasoning chunks per file, yields each violation as parsed.
- `run_strategist` becomes a generator: processes violations one by one, yields reasoning chunks per violation, yields each plan.
- Scan pipeline orchestrates agents as generators, forwarding yields as SSE events.
- DB writes happen inside the SSE handler as results arrive (not batched at the end).

### Frontend

**Flow:** Scan Repository click -> `POST /scan` -> navigate to `/dashboard/scan/[id]` -> page opens EventSource -> streams results.

**Scan page layout:**

1. **Reasoning Trace (top):** Vertical timeline of agent cards.
   - Each agent: collapsible card with name, status indicator (spinning/done), one-line summary.
   - Expanded view: full reasoning trace with typing effect (CSS cursor animation, chunks appended as they arrive).
   - Active agent auto-expands, previous agents auto-collapse. User can toggle any.
   - Monospace font for reasoning text.

2. **Violations & Plans (bottom, appears incrementally):**
   - Violation cards animate in one by one as `violation_found` events arrive.
   - Remediation plan data attaches to violation cards via `plan_ready` events.
   - Approve/PR actions appear only after `scan_complete`.

**State shape:**

```typescript
interface StreamingState {
  agents: {
    name: string;
    status: "pending" | "active" | "done";
    summary: string;
    reasoningChunks: string[];
  }[];
  violations: Violation[];
  plans: Map<string, Plan>;
  scanStatus: "streaming" | "completed" | "failed";
  expandedAgent: string | null;
}
```

**Fallback:** Already-completed scans (from scan history) skip SSE and load via `GET /scans/{id}`.

**States:**
- Streaming: reasoning active, violations appearing, no action buttons
- Completed: agents collapsed with summaries, full violation list, approve/PR buttons
- Failed: error state with partial results shown
