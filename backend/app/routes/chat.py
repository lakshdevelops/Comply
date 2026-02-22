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

    plan_map = {p["violation_id"]: p for p in plans}

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
    _ensure_firebase_initialized()
    try:
        user = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    user_id = user["uid"]

    db = get_db()
    scan = db.execute(
        "SELECT id FROM scans WHERE id = ? AND user_id = ?", (scan_id, user_id)
    ).fetchone()
    db.close()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    def event_generator():
        try:
            _save_message(scan_id, user_id, "user", question)

            violations_summary, regulation_context = _build_violations_summary(scan_id)
            history = _get_conversation_history(scan_id, user_id)

            system_prompt = ADVISOR_SYSTEM_PROMPT.format(
                violations_summary=violations_summary,
                regulation_context=regulation_context,
            )

            history_text = ""
            if len(history) > 1:
                for msg in history[:-1]:
                    role_label = "User" if msg["role"] == "user" else "Advisor"
                    history_text += f"{role_label}: {msg['content']}\n\n"

            user_content = ""
            if history_text:
                user_content += f"CONVERSATION HISTORY:\n{history_text}\n"
            user_content += f"CURRENT QUESTION:\n{question}"

            full_response = ""
            for chunk in invoke_streaming(system_prompt=system_prompt, user_content=user_content):
                full_response += chunk
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

            _save_message(scan_id, user_id, "assistant", full_response)

            yield f"event: done\ndata: {json.dumps({'complete': True})}\n\n"

        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
