from fastapi import APIRouter, Depends
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """
    Returns the Firebase user info extracted from the verified ID token.
    Frontend usage:
        const token = await getIdToken();
        const res = await fetch("http://localhost:8000/api/v1/me", {
            headers: { Authorization: `Bearer ${token}` }
        });
    """
    return {
        "uid": user["uid"],
        "email": user.get("email"),
        "name": user.get("name"),
        "picture": user.get("picture"),
    }
