"""GitHub OAuth connect + repo management (workspace-scoped)."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
import httpx

from app.core.auth_dep import require_consultancy, CurrentUser
from app.core.firestore import get_db
from app.core.encryption import encrypt, decrypt
from app.core.config import settings
from app.models.schemas import GitHubConnectRequest, ConnectRepoRequest

router = APIRouter(tags=["workspace-github"])


def _assert_workspace_access(workspace_id: str, user: CurrentUser) -> dict:
    db = get_db()
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(404, "Workspace not found")
    data = doc.to_dict()
    if data.get("consultancyId") != user.consultancy_id:
        raise HTTPException(403, "Forbidden")
    return data


@router.post("/workspaces/{workspace_id}/github/connect")
async def connect_github(
    workspace_id: str,
    body: GitHubConnectRequest,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            params={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": body.code,
                "redirect_uri": body.redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
    resp.raise_for_status()
    token_data = resp.json()

    if "access_token" not in token_data:
        raise HTTPException(400, f"GitHub OAuth error: {token_data.get('error_description', 'unknown')}")

    access_token = token_data["access_token"]

    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    user_resp.raise_for_status()
    github_user = user_resp.json()

    db = get_db()
    db.collection("workspaces").document(workspace_id).collection(
        "integrations"
    ).document("github").set(
        {
            "mode": "oauth",
            "accessToken": encrypt(access_token),
            "githubUsername": github_user["login"],
            "connectedAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    db.collection("workspaces").document(workspace_id).update(
        {"githubUsername": github_user["login"]}
    )
    return {"connected": True, "githubUsername": github_user["login"]}


@router.get("/workspaces/{workspace_id}/github/repos")
async def list_github_repos(
    workspace_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    gh_doc = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("integrations")
        .document("github")
        .get()
    )
    if not gh_doc.exists:
        raise HTTPException(400, "GitHub not connected for this workspace")

    access_token = decrypt(gh_doc.to_dict()["accessToken"])

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            params={"per_page": 100, "sort": "updated"},
            headers={"Authorization": f"Bearer {access_token}"},
        )
    resp.raise_for_status()
    repos = resp.json()
    return {
        "repos": [
            {"full_name": r["full_name"], "default_branch": r["default_branch"]}
            for r in repos
        ]
    }


@router.post("/workspaces/{workspace_id}/repos", status_code=201)
async def connect_repo(
    workspace_id: str,
    body: ConnectRepoRequest,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    ref = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("repos")
        .document()
    )
    data = {
        "fullName": body.full_name,
        "defaultBranch": body.default_branch,
        "connectedAt": datetime.now(timezone.utc).isoformat(),
        "isActive": True,
    }
    ref.set(data)
    return {"id": ref.id, **data}
