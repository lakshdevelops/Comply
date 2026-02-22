# Chat-First Scan Experience: Unified Agent Timeline

## Problem

The current scan page has a cramped two-column layout: violations on the left (60%) and an empty chat panel on the right (40%). The reasoning trace is a separate collapsible section disconnected from the chat. This wastes space, looks unfinished, and fails to showcase agent observability — a key judging criterion for the hackathon.

The challenge doc explicitly states: *"Teams must provide a 'Decision Log' or 'Chain-of-Thought' export. We want to see how the AI arrived at a specific decision. Black-box prompt-and-response will be scored lower than transparent reasoning."*

## Solution

Replace the two-column layout with a **single centered chat timeline** where everything — agent reasoning, violations, user questions, advisor answers, and PR creation — appears as messages in one continuous narrative.

## Page Layout

- **Top**: Existing repo header card (name, scan date, status) — unchanged
- **Below**: Centered chat timeline (`max-w-3xl`), scrollable, fills viewport height
- **Bottom**: Chat input pinned to viewport bottom, disabled during agent streaming, enabled after scan completes
- **No side panels, no two-column split**

## Chat Message Types

The timeline renders 5 distinct message types:

### 1. Agent Reasoning Card

For: Auditor, Strategist, Code Generator, QA Re-scan, Strategist (Replan)

- Dark header bar with agent name + icon
- Monospace reasoning text on dark background, streams in real-time
- Collapsible: when collapsed shows agent name + result summary; when expanded shows full reasoning
- Streaming cursor (animated pulse) while agent is active
- Result summary line appears when agent completes (e.g., "Found 23 violations across 2 files")

### 2. Violations Widget

Appears after Strategist completes. An interactive in-chat widget containing:

- Severity filter chips: All | Critical | High | Medium
- Approved count + Approve All / Create PRs buttons
- Grouped violations by file (reuses ViolationGroup component internals)
- Each row: severity badge, description, approve checkbox
- Expandable detail: explanation, regulation, proposed change, sample fix
- "Ask about this" button pre-fills chat input

### 3. User Bubble

Right-aligned, warm-brown background. Same styling as current chat.

### 4. Advisor Bubble

Left-aligned, white background with border. Streams via SSE. Same styling as current chat.

### 5. PR Status Card

Appears after PR pipeline completes:

- Success indicator
- Branch name, violation count resolved, QA iteration count
- Link to GitHub PR

## Timeline Flow

### Phase 1 — Scan (SSE streaming)

1. Auditor reasoning card appears, reasoning streams in real-time
2. Auditor completes → result: "Found N violations across M files"
3. Strategist reasoning card appears, reasoning streams
4. Strategist completes → result: "Generated N remediation plans"
5. Violations widget drops in (all unchecked)
6. Chat input enables, starter prompts appear

### Phase 2 — Review & Chat (interactive)

7. User asks questions → user/advisor bubbles (streamed SSE)
8. "Ask about this" on violation rows pre-fills chat input
9. User approves violations via checkboxes in widget
10. User clicks "Create PRs" in widget

### Phase 3 — PR Creation (SSE streaming)

11. Code Generator reasoning card appears, streams
12. Code Generator completes → "N files modified"
13. QA Re-scan reasoning card appears, streams
14. QA completes → "CLEAN" or "N new violations found"
15. If dirty: Strategist Replan card → Code Generator → QA (loop, max 3 iterations)
16. PR Status card drops in with GitHub link

### Phase 4 — Revisit (completed scan)

On page load for a completed scan, reconstruct the message list from DB:

- Auditor card (collapsed, full_text from reasoning_log)
- Strategist card (collapsed, full_text from reasoning_log)
- Violations widget (current approval state from DB)
- All chat messages (from chat_messages table)
- PR status card (from pull_requests table, if exists)
- PR pipeline agent cards (from reasoning_log, if PR was created)

## Backend Changes

### New endpoint: `GET /fixes/create-prs/stream`

SSE streaming version of the current blocking `POST /fixes/create-prs`. Events emitted at each LangGraph node boundary:

| Node | Events |
|------|--------|
| code_gen | `agent_start` → `reasoning_chunk`* → `agent_complete` |
| qa_rescan | `agent_start` → `reasoning_chunk`* → `agent_complete` |
| strategist_replan | `agent_start` → `reasoning_chunk`* → `agent_complete` |
| Pipeline end | `pr_complete {pr_url, branch, violation_count, qa_iterations}` or `pr_error` |

The LangGraph pipeline nodes need to be converted to generators that yield SSE events. The existing `run_code_generator`, `run_auditor`, `run_strategist` already support streaming via `invoke_streaming()` — we just need to wire the chunks through as SSE events.

Auth via query param token (same pattern as scan stream and chat stream, since EventSource can't set headers).

### Persist PR pipeline reasoning

Save each PR pipeline agent's full_text to `reasoning_log` with agent names: "Code Generator", "QA Re-scan", "Strategist (Replan)". This is already partially done — the current pipeline saves to reasoning_log after completion. With streaming, save incrementally.

### No changes to existing endpoints

- `GET /scan/{scan_id}/stream` — unchanged (scan SSE)
- `GET /chat/{scan_id}/stream` — unchanged (advisor SSE)
- `GET /chat/{scan_id}` — unchanged (chat history)
- `POST /fixes/approve` — unchanged (approve violations)

## Frontend Architecture

### Message type system

```typescript
type ChatMessage =
  | { type: "agent"; agent: string; status: "active" | "done"; reasoningChunks: string[]; summary: string }
  | { type: "violations"; violations: Violation[]; approvedIds: Set<string> }
  | { type: "user"; content: string }
  | { type: "assistant"; content: string }
  | { type: "pr_status"; prUrl: string; branch: string; violationCount: number; qaIterations: number }
  | { type: "pr_loading" };
```

A single `messages` state array. `messages.map()` switches on type and renders the appropriate component.

### SSE event mapping

Scan SSE events push into the messages array:
- `agent_start` → append new `{type: "agent"}` message
- `reasoning_chunk` → update last agent message's chunks
- `violation_found` → accumulate into violations state (not rendered individually)
- `plan_ready` → merge plan into matching violation
- `agent_complete` → mark agent done, append summary
- `scan_complete` → append `{type: "violations"}` widget message, enable chat input

PR SSE events follow the same pattern:
- `agent_start/reasoning_chunk/agent_complete` → append/update agent messages
- `pr_complete` → replace `{type: "pr_loading"}` with `{type: "pr_status"}`

Chat messages:
- User sends question → append `{type: "user"}`, append `{type: "assistant"}` (empty), stream chunks into it

### Components

| Component | Purpose |
|-----------|---------|
| `AgentReasoningCard` | New. Renders agent name, streaming reasoning, collapsible, result summary |
| `ViolationsWidget` | New. Wraps ViolationGroup with filter chips and action buttons, embedded in chat |
| `PRStatusCard` | New. Shows PR link, QA results |
| `scan/[id]/page.tsx` | Full rewrite around message list model |
| `ChatPanel.tsx` | Remove (absorbed into page) |

### Revisit reconstruction

When loading a completed scan, build the messages array from DB data:
1. Query reasoning_log for Auditor/Strategist entries → agent messages (collapsed)
2. Query violations + remediation_plans → violations widget message
3. Query chat_messages → user/assistant messages
4. Query pull_requests → PR status message (if exists)
5. Query reasoning_log for Code Generator/QA entries → agent messages (collapsed, if PR exists)

## Files to modify

### Backend
| File | Change |
|------|--------|
| `backend/app/routes/fixes.py` | Add `GET /fixes/create-prs/stream` SSE endpoint, keep existing POST as fallback |
| `backend/app/agents/code_generator.py` | Add streaming variant that yields chunks |
| `backend/app/agents/auditor.py` | Ensure `run_auditor` supports streaming for QA re-scan |
| `backend/app/graphs/pr_pipeline.py` | Convert nodes to generators yielding SSE events |

### Frontend
| File | Change |
|------|--------|
| `comply-landing/src/app/dashboard/scan/[id]/page.tsx` | Full rewrite: message list model, single chat column |
| `comply-landing/src/app/dashboard/components/AgentReasoningCard.tsx` | New component |
| `comply-landing/src/app/dashboard/components/ViolationsWidget.tsx` | New component (wraps ViolationGroup) |
| `comply-landing/src/app/dashboard/components/PRStatusCard.tsx` | New component |
| `comply-landing/src/app/dashboard/components/ChatPanel.tsx` | Delete (absorbed into page) |
| `comply-landing/src/app/dashboard/layout.tsx` | Revert `max-w-7xl` back to `max-w-6xl` (no longer need wide layout) |
| `comply-landing/src/lib/api.ts` | Add `getPRStreamUrl` helper |

### No changes needed
- Agent files (auditor, strategist) — streaming already supported
- Database schema — no new tables needed
- Chat endpoint — unchanged
- Scan SSE endpoint — unchanged
