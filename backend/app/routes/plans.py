"""Fix plan approval (workspace-scoped)."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from app.core.auth_dep import require_consultancy, CurrentUser
from app.core.firestore import get_db

router = APIRouter(tags=["workspace-plans"])


def _assert_workspace(workspace_id: str, user: CurrentUser) -> dict:
    db = get_db()
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(404, "Workspace not found")
    data = doc.to_dict()
    if data.get("consultancyId") != user.consultancy_id:
        raise HTTPException(403, "Forbidden")
    return data


@router.post("/workspaces/{workspace_id}/scans/{scan_id}/plans/{plan_id}/approve")
async def approve_plan(
    workspace_id: str,
    scan_id: str,
    plan_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace(workspace_id, user)
    db = get_db()
    ref = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("scans")
        .document(scan_id)
        .collection("plans")
        .document(plan_id)
    )
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Plan not found")

    ref.update(
        {
            "approved": True,
            "approvedBy": user.uid,
            "approvedAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"planId": plan_id, "approved": True}
