"""Document management for workspace document compliance."""
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.core.auth_dep import require_consultancy, CurrentUser
from app.core.firestore import get_db
from app.models.schemas import DocumentMetadata

router = APIRouter(tags=["documents"])


def _assert_workspace_access(workspace_id: str, user: CurrentUser) -> dict:
    db = get_db()
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(404, "Workspace not found")
    data = doc.to_dict()
    if data.get("consultancyId") != user.consultancy_id:
        raise HTTPException(403, "Forbidden")
    return data


@router.get("/workspaces/{workspace_id}/documents", response_model=List[DocumentMetadata])
async def list_documents(
    workspace_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    docs = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("documents")
        .order_by("uploadedAt", direction="DESCENDING")
        .stream()
    )
    results = []
    for d in docs:
        data = d.to_dict()
        results.append(
            DocumentMetadata(
                id=d.id,
                name=data.get("name", ""),
                storage_path=data.get("storagePath", ""),
                download_url=data.get("downloadURL", ""),
                size=data.get("size", 0),
                content_type=data.get("contentType", ""),
                uploaded_by=data.get("uploadedBy", ""),
                uploaded_at=data.get("uploadedAt", ""),
            )
        )
    return results


@router.delete("/workspaces/{workspace_id}/documents/{document_id}", status_code=204)
async def delete_document(
    workspace_id: str,
    document_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    ref = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("documents")
        .document(document_id)
    )
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Document not found")
    ref.delete()
