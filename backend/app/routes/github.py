from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from app.api.deps import get_current_user
from app.core.security import _ensure_firebase_initialized
from app.core.config import settings
from app.database import get_db
from app.services.github_service import (
    exchange_code_for_token,
    get_user_info,
    get_user_repos,
)
from firebase_admin import auth as firebase_auth
import uuid
from datetime import datetime
import urllib.parse

router = APIRouter()


@router.get("/authorize")
def github_authorize(token: str = Query(...)):
    """Redirect to GitHub OAuth. Frontend opens this URL via browser redirect,
    so the token is passed as a query parameter (not a Bearer header)."""
    _ensure_firebase_initialized()
    try:
        user = firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed.")
    state = user["uid"]  # Use Firebase UID as state
    params = urllib.parse.urlencode(
        {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.GITHUB_REDIRECT_URI,
            "scope": "repo read:user",
            "state": state,
        }
    )
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@router.get("/callback")
def github_callback(code: str, state: str):
    """Handle GitHub OAuth callback. State is the Firebase UID."""
    # Exchange code for token
    token_data = exchange_code_for_token(code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=400, detail="Failed to get GitHub access token"
        )

    # Get GitHub user info
    user_info = get_user_info(access_token)

    # Store token in DB
    db = get_db()
    try:
        db.execute(
            "INSERT OR REPLACE INTO github_tokens (id, user_id, access_token, github_username, created_at) VALUES (?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                state,
                access_token,
                user_info.get("login"),
                datetime.utcnow().isoformat(),
            ),
        )
        db.commit()
    finally:
        db.close()

    # Redirect back to frontend dashboard
    return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard?github=connected")


@router.get("/status")
def github_status(user: dict = Depends(get_current_user)):
    """Check if user has connected their GitHub account."""
    db = get_db()
    try:
        row = db.execute(
            "SELECT github_username FROM github_tokens WHERE user_id = ?",
            (user["uid"],),
        ).fetchone()
    finally:
        db.close()

    if row:
        return {"connected": True, "username": row["github_username"]}
    return {"connected": False}


@router.delete("/disconnect")
def github_disconnect(user: dict = Depends(get_current_user)):
    """Remove the stored GitHub token for the authenticated user."""
    db = get_db()
    db.execute("DELETE FROM github_tokens WHERE user_id = ?", (user["uid"],))
    db.commit()
    db.close()
    return {"detail": "GitHub disconnected"}


@router.get("/repos")
def list_repos(user: dict = Depends(get_current_user)):
    """List GitHub repos for the connected account."""
    db = get_db()
    try:
        row = db.execute(
            "SELECT access_token FROM github_tokens WHERE user_id = ?",
            (user["uid"],),
        ).fetchone()
    finally:
        db.close()

    if not row:
        raise HTTPException(status_code=400, detail="GitHub not connected")

    repos = get_user_repos(row["access_token"])
    return {"repos": repos}
