"""Scan router — trigger scans and read results (workspace-scoped)."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from app.core.auth_dep import require_consultancy, CurrentUser
from app.core.firestore import get_db
from app.models.schemas import TriggerScanRequest

router = APIRouter(tags=["workspace-scans"])


def _assert_workspace_access(workspace_id: str, user: CurrentUser) -> dict:
    db = get_db()
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(404, "Workspace not found")
    data = doc.to_dict()
    if data.get("consultancyId") != user.consultancy_id:
        raise HTTPException(403, "Forbidden")
    return data


@router.post("/workspaces/{workspace_id}/scans", status_code=202)
async def trigger_scan(
    workspace_id: str,
    body: TriggerScanRequest,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    repo_doc = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("repos")
        .document(body.repo_id)
        .get()
    )
    if not repo_doc.exists:
        raise HTTPException(404, "Repo not found")

    now = datetime.now(timezone.utc).isoformat()
    scan_ref = (
        db.collection("workspaces").document(workspace_id).collection("scans").document()
    )
    scan_ref.set(
        {
            "repoId": body.repo_id,
            "commitSha": "HEAD",
            "status": "queued",
            "triggeredBy": user.uid,
            "startedAt": now,
        }
    )
    return {"scanId": scan_ref.id, "status": "queued"}


@router.get("/workspaces/{workspace_id}/scans/{scan_id}")
async def get_scan(
    workspace_id: str,
    scan_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    doc = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("scans")
        .document(scan_id)
        .get()
    )
    if not doc.exists:
        raise HTTPException(404, "Scan not found")
    data = doc.to_dict()
    return {"id": doc.id, **data}


@router.get("/workspaces/{workspace_id}/scans/{scan_id}/findings")
async def list_findings(
    workspace_id: str,
    scan_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    findings = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("scans")
        .document(scan_id)
        .collection("findings")
        .stream()
    )
    return [{"id": f.id, **f.to_dict()} for f in findings]


@router.get("/workspaces/{workspace_id}/scans/{scan_id}/plans")
async def list_plans(
    workspace_id: str,
    scan_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    plans = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("scans")
        .document(scan_id)
        .collection("plans")
        .stream()
    )
    return [{"id": p.id, **p.to_dict()} for p in plans]
