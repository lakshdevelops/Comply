from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.database import get_db
from app.models.schemas import ScanRequest, ScanResponse
from app.services.github_service import get_repo_infra_files
from app.graphs.scan_pipeline import scan_app
import uuid
from datetime import datetime

router = APIRouter()


@router.post("/scan", response_model=ScanResponse)
def trigger_scan(req: ScanRequest, user: dict = Depends(get_current_user)):
    """Trigger a compliance scan on a GitHub repo."""
    user_id = user["uid"]

    # Get GitHub token for this user
    db = get_db()
    try:
        row = db.execute(
            "SELECT access_token FROM github_tokens WHERE user_id = ?", (user_id,)
        ).fetchone()
    finally:
        db.close()

    if not row:
        raise HTTPException(
            status_code=400,
            detail="GitHub not connected. Please connect your GitHub account first.",
        )

    access_token = row["access_token"]

    # Create scan record
    scan_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = get_db()
    try:
        db.execute(
            "INSERT INTO scans (id, user_id, repo_url, repo_owner, repo_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                scan_id,
                user_id,
                f"{req.repo_owner}/{req.repo_name}",
                req.repo_owner,
                req.repo_name,
                "scanning",
                now,
                now,
            ),
        )
        db.commit()
    finally:
        db.close()

    try:
        # Fetch infra files from repo
        repo_files = get_repo_infra_files(access_token, req.repo_owner, req.repo_name)

        if not repo_files:
            empty_log_entry = {
                "agent": "System",
                "action": "scan",
                "output": "No infrastructure files found in repository",
            }
            db = get_db()
            try:
                db.execute(
                    "INSERT INTO reasoning_log (id, scan_id, agent, action, output, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        scan_id,
                        empty_log_entry["agent"],
                        empty_log_entry["action"],
                        empty_log_entry["output"],
                        datetime.utcnow().isoformat(),
                    ),
                )
                db.execute(
                    "UPDATE scans SET status = 'completed', updated_at = ? WHERE id = ?",
                    (datetime.utcnow().isoformat(), scan_id),
                )
                db.commit()
            finally:
                db.close()
            return ScanResponse(
                scan_id=scan_id,
                status="completed",
                violations=[],
                remediation_plans=[],
                reasoning_log=[empty_log_entry],
            )

        # Run scan pipeline
        result = scan_app.invoke(
            {
                "repo_files": repo_files,
                "violations": [],
                "remediation_plans": [],
                "reasoning_log": [],
            }
        )

        violations = result.get("violations", [])
        plans = result.get("remediation_plans", [])
        reasoning_log = result.get("reasoning_log", [])

        # Persist results to DB
        db = get_db()
        try:
            for v in violations:
                vid = v.get("violation_id", str(uuid.uuid4()))
                db.execute(
                    "INSERT INTO violations (id, scan_id, rule_id, severity, file, line, resource, field, current_value, description, regulation_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        vid,
                        scan_id,
                        v.get("rule_id", ""),
                        v.get("severity", "medium"),
                        v.get("file", ""),
                        v.get("line"),
                        v.get("resource"),
                        v.get("field"),
                        v.get("current_value"),
                        v.get("description", ""),
                        v.get("regulation_ref", ""),
                    ),
                )

            for p in plans:
                db.execute(
                    "INSERT INTO remediation_plans (id, scan_id, violation_id, explanation, regulation_citation, what_needs_to_change, sample_fix, estimated_effort, priority, file, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        scan_id,
                        p.get("violation_id", ""),
                        p.get("explanation", ""),
                        p.get("regulation_citation", ""),
                        p.get("what_needs_to_change", ""),
                        p.get("sample_fix"),
                        p.get("estimated_effort"),
                        p.get("priority", "P2"),
                        p.get("file", ""),
                        0,
                    ),
                )

            for entry in reasoning_log:
                db.execute(
                    "INSERT INTO reasoning_log (id, scan_id, agent, action, output, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        scan_id,
                        entry.get("agent", ""),
                        entry.get("action", ""),
                        entry.get("output", ""),
                        datetime.utcnow().isoformat(),
                    ),
                )

            db.execute(
                "UPDATE scans SET status = 'completed', updated_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), scan_id),
            )
            db.commit()
        finally:
            db.close()

        return ScanResponse(
            scan_id=scan_id,
            status="completed",
            violations=violations,
            remediation_plans=plans,
            reasoning_log=reasoning_log,
        )

    except HTTPException:
        raise
    except Exception as e:
        db = get_db()
        try:
            db.execute(
                "UPDATE scans SET status = 'failed', updated_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), scan_id),
            )
            db.commit()
        finally:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))


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
        # Get violation count
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
