from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.core.security import _ensure_firebase_initialized
from app.database import get_db
from app.models.schemas import ScanRequest
from app.services.github_service import get_repo_infra_files
from app.agents.auditor import run_auditor_streaming
from app.agents.strategist import run_strategist_streaming
from firebase_admin import auth as firebase_auth
import uuid
import json
from datetime import datetime

router = APIRouter()


@router.post("/scan")
def trigger_scan(req: ScanRequest, user: dict = Depends(get_current_user)):
    """Create a scan record. The pipeline runs via the SSE stream endpoint."""
    user_id = user["uid"]

    # Verify GitHub connected
    db = get_db()
    try:
        row = db.execute(
            "SELECT access_token FROM github_tokens WHERE user_id = ?", (user_id,)
        ).fetchone()
    finally:
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


def format_sse(event: str, data: dict) -> str:
    """Format a dict as an SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


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
        reasoning_traces: dict[str, list[str]] = {}

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
            reasoning_traces.setdefault("Auditor", []).append("Fetching repository files...\n")
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
                if event["event"] == "reasoning_chunk":
                    reasoning_traces.setdefault(event["data"].get("agent", "Auditor"), []).append(event["data"].get("chunk", ""))
                if event["event"] == "agent_complete":
                    violations = event["data"].get("violations", [])

            # Save violations to DB with unique IDs (Gemini reuses simple IDs like V-001 across scans)
            db = get_db()
            for v in violations:
                vid = str(uuid.uuid4())
                v["db_id"] = vid  # Track the DB ID for plan linking
                db.execute(
                    "INSERT INTO violations (id, scan_id, rule_id, severity, file, line, resource, field, current_value, description, regulation_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (vid, scan_id, v.get("rule_id", ""), v.get("severity", "medium"), v.get("file", ""), v.get("line"), v.get("resource"), v.get("field"), v.get("current_value"), v.get("description", ""), v.get("regulation_ref", "")),
                )
            db.commit()
            db.close()

            # Save auditor reasoning log
            auditor_full_text = "".join(reasoning_traces.get("Auditor", []))
            db = get_db()
            db.execute(
                "INSERT INTO reasoning_log (id, scan_id, agent, action, output, full_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), scan_id, "Auditor", "scan", f"{len(violations)} violations detected", auditor_full_text or None, datetime.utcnow().isoformat()),
            )
            db.commit()
            db.close()

            # Run strategist (streaming) — isolated so auditor results are preserved on failure
            plans = []
            try:
                yield format_sse("agent_start", {"agent": "Strategist", "message": "Building remediation plans..."})
                reasoning_traces.setdefault("Strategist", []).append("Building remediation plans...\n")
                for event in run_strategist_streaming(violations):
                    yield format_sse(event["event"], event["data"])
                    if event["event"] == "reasoning_chunk":
                        reasoning_traces.setdefault(event["data"].get("agent", "Strategist"), []).append(event["data"].get("chunk", ""))
                    if event["event"] == "agent_complete":
                        plans = event["data"].get("plans", [])

                # Save plans to DB, linking to the DB violation IDs
                vid_map = {v.get("violation_id", ""): v.get("db_id", "") for v in violations}
                db = get_db()
                for p in plans:
                    pid = str(uuid.uuid4())
                    db_vid = vid_map.get(p.get("violation_id", ""), p.get("violation_id", ""))
                    db.execute(
                        "INSERT INTO remediation_plans (id, scan_id, violation_id, explanation, regulation_citation, what_needs_to_change, sample_fix, estimated_effort, priority, file, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (pid, scan_id, db_vid, p.get("explanation", ""), p.get("regulation_citation", ""), p.get("what_needs_to_change", ""), p.get("sample_fix"), p.get("estimated_effort"), p.get("priority", "P2"), p.get("file", ""), 0),
                    )
                strategist_full_text = "".join(reasoning_traces.get("Strategist", []))
                db.execute(
                    "INSERT INTO reasoning_log (id, scan_id, agent, action, output, full_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), scan_id, "Strategist", "plan", f"{len(plans)} remediation plans produced", strategist_full_text or None, datetime.utcnow().isoformat()),
                )
                db.commit()
                db.close()

            except Exception as strat_err:
                yield format_sse("agent_complete", {"agent": "Strategist", "summary": f"Failed: {strat_err}"})
                strategist_full_text = "".join(reasoning_traces.get("Strategist", []))
                db = get_db()
                db.execute(
                    "INSERT INTO reasoning_log (id, scan_id, agent, action, output, full_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), scan_id, "Strategist", "plan", f"Error: {strat_err}", strategist_full_text or None, datetime.utcnow().isoformat()),
                )
                db.commit()
                db.close()

            # Mark scan completed (violations are always preserved)
            db = get_db()
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


@router.get("/scans")
def list_scans(user: dict = Depends(get_current_user)):
    """List all scans for the authenticated user."""
    user_id = user["uid"]
    db = get_db()
    try:
        rows = db.execute(
            """
            SELECT s.id, s.repo_url, s.repo_owner, s.repo_name, s.status,
                   s.created_at, s.updated_at,
                   COUNT(v.id) as violation_count
            FROM scans s
            LEFT JOIN violations v ON v.scan_id = s.id
            WHERE s.user_id = ?
            GROUP BY s.id
            ORDER BY s.created_at DESC
            """,
            (user_id,),
        ).fetchall()
    finally:
        db.close()

    scans = []
    for row in rows:
        db2 = get_db()
        count = db2.execute(
            "SELECT COUNT(*) as cnt FROM violations WHERE scan_id = ?", (row["id"],)
        ).fetchone()["cnt"]
        db2.close()
        scans.append(
            {
                "id": row["id"],
                "repo_url": row["repo_url"],
                "repo_owner": row["repo_owner"],
                "repo_name": row["repo_name"],
                "status": row["status"],
                "violation_count": count,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )

    return {"scans": scans}


@router.get("/scans/{scan_id}")
def get_scan(scan_id: str, user: dict = Depends(get_current_user)):
    """Get full scan details including violations, plans, and reasoning log."""
    user_id = user["uid"]
    db = get_db()
    try:
        scan = db.execute(
            "SELECT * FROM scans WHERE id = ? AND user_id = ?", (scan_id, user_id)
        ).fetchone()
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")

        violations = [
            dict(row)
            for row in db.execute(
                "SELECT * FROM violations WHERE scan_id = ?", (scan_id,)
            ).fetchall()
        ]
        plans = [
            dict(row)
            for row in db.execute(
                "SELECT * FROM remediation_plans WHERE scan_id = ?", (scan_id,)
            ).fetchall()
        ]
        reasoning = [
            dict(row)
            for row in db.execute(
                "SELECT * FROM reasoning_log WHERE scan_id = ? ORDER BY created_at",
                (scan_id,),
            ).fetchall()
        ]
        prs = [
            dict(row)
            for row in db.execute(
                "SELECT * FROM pull_requests WHERE scan_id = ?", (scan_id,)
            ).fetchall()
        ]
    finally:
        db.close()

    return {
        "scan_id": scan["id"],
        "repo_url": scan["repo_url"],
        "repo_owner": scan["repo_owner"],
        "repo_name": scan["repo_name"],
        "status": scan["status"],
        "created_at": scan["created_at"],
        "violations": violations,
        "remediation_plans": plans,
        "reasoning_log": reasoning,
        "pull_requests": prs,
    }


@router.delete("/scans/{scan_id}")
def delete_scan(scan_id: str, user: dict = Depends(get_current_user)):
    """Delete a scan and all related data."""
    user_id = user["uid"]
    db = get_db()

    scan = db.execute(
        "SELECT id FROM scans WHERE id = ? AND user_id = ?", (scan_id, user_id)
    ).fetchone()
    if not scan:
        db.close()
        raise HTTPException(status_code=404, detail="Scan not found")

    db.execute("DELETE FROM chat_messages WHERE scan_id = ?", (scan_id,))
    db.execute("DELETE FROM reasoning_log WHERE scan_id = ?", (scan_id,))
    db.execute("DELETE FROM pull_requests WHERE scan_id = ?", (scan_id,))
    db.execute("DELETE FROM qa_results WHERE scan_id = ?", (scan_id,))
    db.execute("DELETE FROM approved_fixes WHERE scan_id = ?", (scan_id,))
    db.execute("DELETE FROM remediation_plans WHERE scan_id = ?", (scan_id,))
    db.execute("DELETE FROM violations WHERE scan_id = ?", (scan_id,))
    db.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
    db.commit()
    db.close()

    return {"detail": "Scan deleted"}
