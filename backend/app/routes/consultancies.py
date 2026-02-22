"""Consultancy router — create and get."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from app.core.auth_dep import get_current_user_with_consultancy, CurrentUser
from app.core.firestore import get_db
from app.models.schemas import CreateConsultancyRequest, ConsultancyResponse

router = APIRouter(prefix="/consultancies", tags=["consultancies"])


@router.post("", response_model=ConsultancyResponse, status_code=201)
async def create_consultancy(
    body: CreateConsultancyRequest,
    user: CurrentUser = Depends(get_current_user_with_consultancy),
):
    db = get_db()
    user_doc = db.collection("users").document(user.uid).get()
    if user_doc.exists and user_doc.to_dict().get("consultancyId"):
        raise HTTPException(400, "User already belongs to a consultancy.")

    now = datetime.now(timezone.utc)
    consultancy_ref = db.collection("consultancies").document()
    consultancy_ref.set(
        {
            "name": body.name,
            "createdBy": user.uid,
            "plan": "hackathon",
            "createdAt": now.isoformat(),
        }
    )
    consultancy_ref.collection("members").document(user.uid).set(
        {"role": "owner", "joinedAt": now.isoformat()}
    )
    db.collection("users").document(user.uid).set(
        {"consultancyId": consultancy_ref.id, "role": "owner", "email": user.email},
        merge=True,
    )
    return ConsultancyResponse(
        id=consultancy_ref.id,
        name=body.name,
        created_by=user.uid,
        plan="hackathon",
        created_at=now.isoformat(),
    )


@router.get("/{consultancy_id}", response_model=ConsultancyResponse)
async def get_consultancy(
    consultancy_id: str,
    user: CurrentUser = Depends(get_current_user_with_consultancy),
):
    db = get_db()
    doc = db.collection("consultancies").document(consultancy_id).get()
    if not doc.exists:
        raise HTTPException(404, "Consultancy not found")
    data = doc.to_dict()
    if data.get("createdBy") != user.uid and user.consultancy_id != consultancy_id:
        raise HTTPException(403, "Forbidden")
    return ConsultancyResponse(
        id=doc.id,
        name=data["name"],
        created_by=data["createdBy"],
        plan=data["plan"],
        created_at=data.get("createdAt", ""),
    )
