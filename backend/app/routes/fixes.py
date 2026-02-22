from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.database import get_db
from app.models.schemas import ApproveRequest, CreatePRsRequest
from app.services.github_service import get_repo_infra_files, create_pr
from app.graphs.pr_pipeline import pr_app
import json
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

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

    # Reset all approvals for this scan, then set approved for selected ones
    db.execute(
        "UPDATE remediation_plans SET approved = 0 WHERE scan_id = ?",
        (req.scan_id,),
    )
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
def create_prs(req: CreatePRsRequest, user: dict = Depends(get_current_user)):
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
                "current_plans": approved_plans,
                "current_files": repo_files,
                "fixes": [],
                "all_fixes": [],
                "qa_iterations": 0,
                "qa_clean": False,
                "qa_violations": [],
                "qa_history": [],
                "reasoning_log": [],
            }
        )

        all_fixes = result.get("all_fixes", [])
        reasoning_log = result.get("reasoning_log", [])
        qa_history = result.get("qa_history", [])

        # Create PRs via GitHub API using accumulated fixes
        file_fixes = []
        for fix in all_fixes:
            file_fixes.append(
                {"file": fix["file"], "fixed_content": fix["fixed_content"]}
            )

        # Use original approved_plans for PR description (all_fixes.plans gets
        # overwritten by QA loop iterations, but the PR should list all approved violations)
        pr_result = create_pr(
            access_token, scan["repo_owner"], scan["repo_name"], file_fixes, approved_plans
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
                len(approved_plans),
                pr_result["branch"],
            ),
        )

        # Persist QA results
        for entry in qa_history:
            db.execute(
                "INSERT INTO qa_results (id, scan_id, iteration, is_clean, new_violations_json) VALUES (?, ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    req.scan_id,
                    entry["iteration"],
                    1 if entry["is_clean"] else 0,
                    json.dumps(entry["violations"]),
                ),
            )

        # Save reasoning log
        for entry in reasoning_log:
            db.execute(
                "INSERT INTO reasoning_log (id, scan_id, agent, action, output, full_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    req.scan_id,
                    entry.get("agent", ""),
                    entry.get("action", ""),
                    entry.get("output", ""),
                    None,
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


@router.get("/fixes/create-prs/stream")
def stream_create_prs(scan_id: str = Query(...), token: str = Query(...)):
    """SSE endpoint that streams PR pipeline agent events."""
    from app.core.security import _ensure_firebase_initialized
    from firebase_admin import auth as firebase_auth
    from app.agents.code_generator import run_code_generator_streaming
    from app.agents.auditor import run_auditor
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

    logger.info(f"PR stream: scan={scan_id}, approved_plans={len(approved_plans)}, repo_files={len(repo_files)}")

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
                            # Store full code in traces for download (not streamed to UI)
                            reasoning_traces.setdefault("Code Generator", []).append(f"\n--- Generated code for {file_path} ---\n{fixed_content}\n")
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
                    # Send QA violations so the frontend can display them
                    yield format_sse("qa_violations", {"violations": new_violations, "iteration": iteration + 1})

                if iteration >= 2:
                    break

                # --- Strategist Replan ---
                yield format_sse("agent_start", {"agent": "Strategist (Replan)", "message": "Generating new remediation plans..."})
                reasoning_traces.setdefault("Strategist (Replan)", []).append("Replanning...\n")

                new_plans = []
                for event in run_strategist_streaming(new_violations):
                    # Override agent name to match the card we created
                    data = dict(event["data"])
                    data["agent"] = "Strategist (Replan)"
                    evt_type = event["event"]
                    # Skip the strategist's own agent_complete and plan_ready events
                    if evt_type == "agent_complete":
                        new_plans = event["data"].get("plans", [])
                        continue
                    if evt_type == "plan_ready":
                        continue
                    yield format_sse(evt_type, data)
                    if evt_type == "reasoning_chunk":
                        reasoning_traces.setdefault("Strategist (Replan)", []).append(event["data"].get("chunk", ""))

                yield format_sse("agent_complete", {"agent": "Strategist (Replan)", "summary": f"{len(new_plans)} new remediation plans"})
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
            logger.exception(f"PR stream error: {e}")
            yield format_sse("pr_error", {"message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
