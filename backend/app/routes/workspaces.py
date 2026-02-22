"""Workspace router — CRUD scoped to user's consultancy."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import List

from app.core.auth_dep import require_consultancy, CurrentUser
from app.core.firestore import get_db
from app.models.schemas import CreateWorkspaceRequest, WorkspaceResponse

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _ws_to_response(doc_id: str, data: dict) -> WorkspaceResponse:
    return WorkspaceResponse(
        id=doc_id,
        consultancy_id=data["consultancyId"],
        client_name=data["clientName"],
        client_industry=data["clientIndustry"],
        compliance_frameworks=data.get("complianceFrameworks", []),
        cloud_provider=data["cloudProvider"],
        infrastructure_type=data["infrastructureType"],
        status=data["status"],
        created_by=data["createdBy"],
        created_at=data.get("createdAt", ""),
    )


@router.get("", response_model=List[WorkspaceResponse])
async def list_workspaces(user: CurrentUser = Depends(require_consultancy)):
    db = get_db()
    docs = (
        db.collection("workspaces")
        .where("consultancyId", "==", user.consultancy_id)
        .order_by("createdAt", direction="DESCENDING")
        .stream()
    )
    return [_ws_to_response(d.id, d.to_dict()) for d in docs]


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    body: CreateWorkspaceRequest,
    user: CurrentUser = Depends(require_consultancy),
):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    ref = db.collection("workspaces").document()
    data = {
        "consultancyId": user.consultancy_id,
        "clientName": body.client_name,
        "clientIndustry": body.client_industry,
        "complianceFrameworks": [f.value for f in body.compliance_frameworks],
        "cloudProvider": body.cloud_provider.value,
        "infrastructureType": body.infrastructure_type.value,
        "status": "active",
        "createdBy": user.uid,
        "createdAt": now,
    }
    ref.set(data)
    return _ws_to_response(ref.id, data)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    db = get_db()
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(404, "Workspace not found")
    data = doc.to_dict()
    if data.get("consultancyId") != user.consultancy_id:
        raise HTTPException(403, "Forbidden")
    return _ws_to_response(doc.id, data)
