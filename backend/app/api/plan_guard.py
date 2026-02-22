"""
Plan‑based feature gating dependency for FastAPI routes.

Usage:
    @router.post("/some-endpoint")
    def endpoint(user=Depends(get_current_user), _=Depends(require_feature("auto_pr"))):
        ...
"""

from fastapi import Depends, HTTPException
from firebase_admin import firestore

from app.api.deps import get_current_user
from app.core.security import ensure_firebase_initialized
from app.models.schemas import PLAN_FEATURES
from app.database import get_db


def get_user_plan(user_id: str) -> str:
    """Return the effective plan for a user ('free' if none / not active)."""
    ensure_firebase_initialized()
    fs = firestore.client()
    doc = fs.collection("subscriptions").document(user_id).get()
    if doc.exists:
        data = doc.to_dict()
        if data.get("status") == "active":
            return data.get("plan", "free")
    return "free"


_MIN_PLAN_FOR_FEATURE: dict[str, str] = {
    "continuous_scanning": "pro",
    "auto_pr": "pro",
    "legal_agent": "enterprise",
    "audit_logging": "pro",
    "sso": "enterprise",
}


def require_feature(feature_name: str):
    """Return a FastAPI dependency that blocks requests when the user's plan
    does not include *feature_name*."""

    def _guard(user: dict = Depends(get_current_user)):
        plan = get_user_plan(user["uid"])
        features = PLAN_FEATURES.get(plan, PLAN_FEATURES["free"])

        if not features.get(feature_name, False):
            min_plan = _MIN_PLAN_FOR_FEATURE.get(feature_name, "pro")
            raise HTTPException(
                status_code=403,
                detail=f"Upgrade to the {min_plan} plan to access {feature_name.replace('_', ' ')}.",
            )

    return _guard


def require_repo_limit():
    """FastAPI dependency that checks if the user can add another repo."""

    def _guard(user: dict = Depends(get_current_user)):
        plan = get_user_plan(user["uid"])
        features = PLAN_FEATURES.get(plan, PLAN_FEATURES["free"])
        max_repos = features.get("max_repos", 1)

        if max_repos == -1:  # unlimited
            return

        db = get_db()
        try:
            row = db.execute(
                "SELECT COUNT(DISTINCT repo_name) as cnt FROM scans WHERE user_id = ?",
                (user["uid"],),
            ).fetchone()
            count = row["cnt"] if row else 0
        finally:
            db.close()

        if count >= max_repos:
            raise HTTPException(
                status_code=403,
                detail=f"Your {plan} plan allows up to {max_repos} repo(s). Upgrade to add more.",
            )

    return _guard
