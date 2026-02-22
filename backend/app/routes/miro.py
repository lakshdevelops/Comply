"""
Miro OAuth + MCP routes.

OAuth flow:
  GET  /miro/authorize        → redirects user to Miro OAuth consent page
  GET  /miro/callback         → receives code, exchanges for token, stores in DB
  GET  /miro/status           → returns whether the current user has connected Miro

MCP tool proxy:
  POST /miro/tools            → call any Miro MCP tool on behalf of the authenticated user
  GET  /miro/tools            → list all available tools on the Miro MCP server

Diagram shortcut:
  POST /miro/diagram          → create a Miro diagram from a scan's violations summary
"""

import urllib.parse
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from firebase_admin import auth as firebase_auth, firestore

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import _ensure_firebase_initialized
from app.services.miro_mcp import MiroMCPError, call_tool, list_tools


def _get_fs():
    """Return a Firestore client (Firebase Admin must already be initialised)."""
    return firestore.client()

router = APIRouter()

_MIRO_AUTH_URL = "https://miro.com/oauth/authorize"
_MIRO_TOKEN_URL = "https://api.miro.com/v1/oauth/token"


# ── helpers ──────────────────────────────────────────────────────────────────

def _get_miro_token(user_id: str) -> str:
    """Fetch the stored Miro access token for a user, raise 400 if not connected."""
    _ensure_firebase_initialized()
    doc = _get_fs().collection("miro_tokens").document(user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=400, detail="Miro not connected. Please connect via /miro/authorize.")
    return doc.to_dict()["access_token"]


# ── OAuth ─────────────────────────────────────────────────────────────────────

@router.get("/authorize")
def miro_authorize(token: str = Query(...)):
    """Redirect the user to the Miro OAuth consent page.
    Token is passed as ?token= query param (same pattern as /github/authorize)
    so this URL can be used as a browser redirect target.
    """
    _ensure_firebase_initialized()
    try:
        user = firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed.")

    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": settings.MIRO_CLIENT_ID,
        "redirect_uri": settings.MIRO_REDIRECT_URI,
        "state": user["uid"],
    })
    return RedirectResponse(f"{_MIRO_AUTH_URL}?{params}")


@router.get("/callback")
def miro_callback(code: str, state: str):
    """
    Handle the Miro OAuth callback.
    `state` carries the Firebase UID set in /authorize.
    """
    # Exchange the authorisation code for an access token
    try:
        resp = httpx.post(
            _MIRO_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.MIRO_CLIENT_ID,
                "client_secret": settings.MIRO_CLIENT_SECRET,
                "redirect_uri": settings.MIRO_REDIRECT_URI,
                "code": code,
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Miro token exchange failed: {exc}")

    token_data = resp.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    miro_user_id = str(token_data.get("user_id", ""))

    if not access_token:
        raise HTTPException(status_code=502, detail="No access_token in Miro response")

    _ensure_firebase_initialized()
    _get_fs().collection("miro_tokens").document(state).set({
        "user_id": state,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "miro_user_id": miro_user_id,
        "created_at": datetime.utcnow().isoformat(),
    })

    return RedirectResponse(f"{settings.FRONTEND_URL}/dashboard?miro=connected")


@router.get("/status")
def miro_status(user: dict = Depends(get_current_user)):
    """Return whether the current user has a stored Miro token."""
    _ensure_firebase_initialized()
    doc = _get_fs().collection("miro_tokens").document(user["uid"]).get()
    if doc.exists:
        data = doc.to_dict()
        return {"connected": True, "miro_user_id": data.get("miro_user_id")}
    return {"connected": False, "miro_user_id": None}


# ── MCP tool proxy ────────────────────────────────────────────────────────────

class ToolCallRequest(BaseModel):
    name: str
    arguments: dict = {}


@router.get("/tools")
async def miro_list_tools(user: dict = Depends(get_current_user)):
    """List all tools available on the Miro MCP server."""
    token = _get_miro_token(user["uid"])
    try:
        tools = await list_tools(token)
    except MiroMCPError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"tools": tools}


@router.post("/tools")
async def miro_call_tool(req: ToolCallRequest, user: dict = Depends(get_current_user)):
    """Generic proxy – call any Miro MCP tool by name with arbitrary arguments."""
    token = _get_miro_token(user["uid"])
    try:
        result = await call_tool(req.name, req.arguments, token)
    except MiroMCPError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"result": result}


# ── Diagram shortcut ─────────────────────────────────────────────────────────

class DiagramRequest(BaseModel):
    scan_id: str
    board_id: str | None = None   # optional: attach to existing board


@router.post("/diagram")
async def create_diagram(req: DiagramRequest, user: dict = Depends(get_current_user)):
    """
    Create a Miro diagram from a scan's violations.
    Fetches violation data from the DB and calls the `diagram_create` MCP tool.
    """
    token = _get_miro_token(user["uid"])

    # ── Fetch scan data from SQLite ──────────────────────────────────────────
    from app.database import get_db
    db = get_db()
    try:
        scan = db.execute(
            "SELECT * FROM scans WHERE id = ? AND user_id = ?",
            (req.scan_id, user["uid"]),
        ).fetchone()
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")

        violations = [
            dict(row)
            for row in db.execute(
                "SELECT severity, file, description, regulation_ref FROM violations WHERE scan_id = ?",
                (req.scan_id,),
            ).fetchall()
        ]
    finally:
        db.close()

    # ── Build a simple DSL / description for the diagram ────────────────────
    lines = [f"## Compliance Scan: {scan['repo_name']}", ""]
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    for v in sorted(violations, key=lambda x: severity_order.get(x["severity"], 99)):
        lines.append(
            f"[{v['severity']}] {v['file']} — {v['description']} ({v['regulation_ref']})"
        )

    dsl = "\n".join(lines)

    # ── Call MCP ─────────────────────────────────────────────────────────────
    arguments: dict = {"content": dsl}
    if req.board_id:
        arguments["boardId"] = req.board_id

    try:
        result = await call_tool("diagram_create", arguments, token)
    except MiroMCPError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "scan_id": req.scan_id,
        "miro_result": result,
    }
