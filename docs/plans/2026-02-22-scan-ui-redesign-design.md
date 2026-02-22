# Scan UI Redesign: Grouped Violations + Compliance Advisor Chat

## Problem

The scan results page displays all violations as full-size cards in a flat list. With 23+ violations this creates an unnavigable wall of content. Non-technical compliance users have no way to ask follow-up questions about regulations or get plain-language explanations of what violations mean for their organization.

## Solution

Redesign the scan page into a **two-column layout** with grouped violations on the left and a persistent compliance advisor chat on the right.

## Page Layout

### Two-column split (completed scans)
- **Left column (~60%)**: Header, Reasoning Trace (collapsed), Violations grouped by file, action bar
- **Right column (~40%)**: Compliance Advisor chat panel, sticky to viewport

### Single-column (streaming scans)
During scan execution the layout stays single-column as today. The chat panel appears once the scan completes.

### Mobile/narrow screens
Chat becomes a slide-up drawer triggered by a floating button.

## Violations Section

### Filter bar
Top of the violations section, contains:
- **Severity chips**: `All` | `Critical` | `High` | `Medium` — click to filter
- **Sort dropdown**: By severity (default) | By priority | By file
- **Action buttons**: Approve All / Deselect All / Create PRs

### File groups
Each file is a collapsible section showing its violation count:

```
▼ demo/sample-infra/k8s/deployment.yaml (4 violations)
    🟡 MED  Single replica, no redundancy...        [✓]
    🟠 HIGH No resource limits defined...            [✓]
    🟠 HIGH No liveness probes configured...         [✓]
    🟠 HIGH No readiness probes configured...        [✓]

▼ demo/sample-infra/terraform/main.tf (19 violations)
    ...
```

### Compact rows
Each violation is **one line**: severity badge, truncated description, approve checkbox.

**Click a row** to expand inline showing full detail: what's wrong, regulation citation, proposed change, effort, priority, sample fix. Essentially the current ViolationCard content nested inside the group.

**"Ask about this" button** on expanded rows pre-loads the violation context into the chat input.

## Compliance Advisor Chat

### UI
- **Header**: "Compliance Advisor" with AI indicator
- **Message history**: User/assistant message bubbles, scrollable
- **Input bar**: Text input + send button at the bottom
- **Starter prompts** (when empty): "Summarize the most critical issues", "Which violations should I fix first?", "Explain GDPR Article 32 in plain English"

### "Ask about this" flow
Clicking the button on a violation row populates the chat input with a pre-written question like *"Explain the violation in deployment.yaml line 78: No resource limits defined"*. User can edit before sending.

### Streaming
Response streams via SSE so the user sees the answer appear incrementally, matching the existing streaming pattern in the app.

## Chat Backend

### New endpoint: `POST /chat/ask`

**Input**:
```json
{
  "scan_id": "uuid",
  "question": "What does GDPR Article 32 mean for us?"
}
```

**Processing**:
1. Load all violations + plans for the scan_id (compact JSON summary)
2. Load conversation history from DB (last 20 messages)
3. Send to LLM with system prompt: "You are a compliance advisor. Here are the scan violations: {summary}. Answer the user's question. If you need deeper regulatory context, use the get_regulation_context tool."
4. LLM uses Gemini function calling with a `get_regulation_context(regulation_ref)` tool that calls the existing `get_article_context()` service function
5. Save user message and assistant response to DB
6. Stream response via SSE

**Output** (streamed): `{ answer, references[] }` — the answer text plus any regulation refs looked up.

### New endpoint: `GET /chat/{scan_id}`

Returns all chat messages for the scan, ordered by `created_at`. Used to load history on page load.

## Database

### New table: `chat_messages`

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scans(id),
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,        -- 'user' or 'assistant'
    content TEXT NOT NULL,
    references_json TEXT,      -- regulation refs the LLM looked up (assistant only)
    created_at TEXT NOT NULL
)
```

- One chat thread per scan, per user
- Delete scan cascades to delete chat messages (add to existing delete_scan route)
- Conversation history sent to LLM is last 20 messages from DB

## Files to modify

### Backend
| File | Change |
|------|--------|
| `backend/app/database.py` | Add `chat_messages` table |
| `backend/app/routes/chat.py` | New file: `POST /chat/ask` (SSE streaming), `GET /chat/{scan_id}` |
| `backend/app/main.py` | Register chat router |
| `backend/app/routes/scan.py` | Add `DELETE FROM chat_messages` to delete_scan |

### Frontend
| File | Change |
|------|--------|
| `comply-landing/src/app/dashboard/scan/[id]/page.tsx` | Two-column layout, replace flat card list with grouped violations |
| `comply-landing/src/app/dashboard/components/ViolationCard.tsx` | Remove or replace with compact ViolationRow + expandable detail |
| `comply-landing/src/app/dashboard/components/ChatPanel.tsx` | New file: compliance advisor chat panel |
| `comply-landing/src/app/dashboard/components/ViolationGroup.tsx` | New file: file group with expandable violation rows |
| `comply-landing/src/lib/api.ts` | Add `getChatHistory`, `getChatStreamUrl` helpers |

### No changes needed
- Agent files (auditor, strategist, code_generator) — untouched
- PR pipeline — untouched
- Fixes routes — untouched
