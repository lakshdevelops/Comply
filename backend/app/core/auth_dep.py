"""Extended auth dependency with consultancy context."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user
from app.core.firestore import get_db


class CurrentUser:
    def __init__(self, uid: str, email: str, consultancy_id: Optional[str]):
        self.uid = uid
        self.email = email
        self.consultancy_id = consultancy_id


async def get_current_user_with_consultancy(
    firebase_user: dict = Depends(get_current_user),
) -> CurrentUser:
    uid = firebase_user["uid"]
    email = firebase_user.get("email", "")

    db = get_db()
    user_doc = db.collection("users").document(uid).get()
    consultancy_id = None
    if user_doc.exists:
        consultancy_id = user_doc.to_dict().get("consultancyId")

    return CurrentUser(uid=uid, email=email, consultancy_id=consultancy_id)


def require_consultancy(
    user: CurrentUser = Depends(get_current_user_with_consultancy),
) -> CurrentUser:
    if not user.consultancy_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to a consultancy yet.",
        )
    return user
