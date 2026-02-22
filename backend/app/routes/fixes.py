from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_current_user
from app.api.plan_guard import require_feature
from app.database import get_db
from app.models.schemas import ApproveRequest, CreatePRsRequest
from app.services.github_service import get_repo_infra_files, create_pr
from app.graphs.pr_pipeline import pr_app
import uuid
from datetime import datetime

router = APIRouter()


@router.post("/fixes/approve")
def approve_fixes(req: ApproveRequest, user: dict = Depends(get_current_user)):
    """Mark specific violations as approved for remediation."""
    db = get_db()

    # Verify scan belongs to user
    scan = db.execute(
        "SELECT * FROM scans WHERE id = ? AND user_id = ?",
        (req.scan_id, user["uid"]),
    ).fetchone()
    if not scan:
        db.close()
        raise HTTPException(status_code=404, detail="Scan not found")

    # Mark remediation plans as approved
    for vid in req.violation_ids:
        db.execute(
            "UPDATE remediation_plans SET approved = 1 WHERE scan_id = ? AND violation_id = ?",
            (req.scan_id, vid),
        )

    db.commit()

    # Get count of approved
    count = db.execute(
        "SELECT COUNT(*) as cnt FROM remediation_plans WHERE scan_id = ? AND approved = 1",
        (req.scan_id,),
    ).fetchone()["cnt"]
    db.close()

    return {"approved_count": count, "scan_id": req.scan_id}


@router.post("/fixes/create-prs")
def create_prs(
    req: CreatePRsRequest,
    user: dict = Depends(get_current_user),
    _auto_pr=Depends(require_feature("auto_pr")),
):
    """Run PR pipeline for approved fixes and create GitHub PRs."""
    user_id = user["uid"]
    db = get_db()

    # Verify scan
    scan = db.execute(
        "SELECT * FROM scans WHERE id = ? AND user_id = ?",
        (req.scan_id, user_id),
    ).fetchone()
    if not scan:
        db.close()
        raise HTTPException(status_code=404, detail="Scan not found")

    # Get GitHub token
    token_row = db.execute(
        "SELECT access_token FROM github_tokens WHERE user_id = ?", (user_id,)
    ).fetchone()
    if not token_row:
        db.close()
        raise HTTPException(status_code=400, detail="GitHub not connected")

    access_token = token_row["access_token"]

    # Get approved plans
    approved_plans = [
        dict(row)
        for row in db.execute(
            "SELECT rp.*, v.file as v_file FROM remediation_plans rp JOIN violations v ON rp.violation_id = v.id WHERE rp.scan_id = ? AND rp.approved = 1",
            (req.scan_id,),
        ).fetchall()
    ]

    if not approved_plans:
        db.close()
        raise HTTPException(
            status_code=400, detail="No approved fixes to generate PRs for"
        )

    # Get repo files
    repo_files = get_repo_infra_files(
        access_token, scan["repo_owner"], scan["repo_name"]
    )

    db.close()

    try:
        # Run PR pipeline
        result = pr_app.invoke(
            {
                "repo_files": repo_files,
                "approved_plans": approved_plans,
                "fixes": [],
                "qa_iterations": 0,
                "qa_clean": False,
                "reasoning_log": [],
            }
        )

        fixes = result.get("fixes", [])
        reasoning_log = result.get("reasoning_log", [])

        # Create PRs via GitHub API
        all_plans = []
        file_fixes = []
        for fix in fixes:
            file_fixes.append(
                {"file": fix["file"], "fixed_content": fix["fixed_content"]}
            )
            all_plans.extend(fix.get("plans", []))

        pr_result = create_pr(
            access_token, scan["repo_owner"], scan["repo_name"], file_fixes, all_plans
        )

        # Save to DB
        db = get_db()
        db.execute(
            "INSERT INTO pull_requests (id, scan_id, pr_url, file, violation_count, branch_name) VALUES (?, ?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                req.scan_id,
                pr_result["pr_url"],
                ",".join(f["file"] for f in file_fixes),
                len(all_plans),
                pr_result["branch"],
            ),
        )

        # Save reasoning log
        for entry in reasoning_log:
            db.execute(
                "INSERT INTO reasoning_log (id, scan_id, agent, action, output, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    req.scan_id,
                    entry.get("agent", ""),
                    entry.get("action", ""),
                    entry.get("output", ""),
                    datetime.utcnow().isoformat(),
                ),
            )

        db.commit()
        db.close()

        return {
            "scan_id": req.scan_id,
            "pull_requests": [pr_result],
            "reasoning_log": reasoning_log,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
