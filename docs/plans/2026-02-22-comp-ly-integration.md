# Comp.ly Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge Vrun's Comp.ly repository (documentation compliance, workspaces, consultancies, legal MCP) into the existing Comply codebase on a new branch.

**Architecture:** Copy & adapt approach — friend's backend routers go into `backend/app/routes/`, frontend pages go into `comply-landing/src/app/dashboard/workspaces/`. Existing SQLite stays for code scans; Firestore added for workspaces/consultancies/documents.

**Tech Stack:** FastAPI, Firestore, Firebase Auth, Next.js 16, Tailwind CSS, Fernet encryption, Legal MCP (Node.js)

---

### Task 1: Create integration branch and copy Legal MCP server

**Files:**
- Copy: `open-legal-compliance-mcp/` (entire directory from `/tmp/comp_ly_friend/`)

**Step 1: Create branch**

```bash
git checkout -b feat/comp-ly-integration
```

**Step 2: Copy Legal MCP server**

```bash
cp -r /tmp/comp_ly_friend/open-legal-compliance-mcp/ /Users/mohammadtallab/Documents/GitHub/Comply/open-legal-compliance-mcp/
```

**Step 3: Commit**

```bash
git add open-legal-compliance-mcp/
git commit -m "feat: add legal compliance MCP server from Comp.ly"
```

---

### Task 2: Backend — update dependencies and config

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/core/config.py`

**Step 1: Add new dependencies to requirements.txt**

Add these lines to the end of `backend/requirements.txt`:

```
pydantic-settings>=2.3.4
httpx>=0.27.0
cryptography>=42.0.8
pdfplumber>=0.11.0
python-docx>=1.1.0
openpyxl>=3.1.0
aiofiles>=23.0.0
```

Note: `cryptography` and some others may already be present — skip duplicates.

**Step 2: Update config.py to add Comp.ly settings**

Replace `backend/app/core/config.py` with:

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Existing settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/v1/github/callback")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./comply.db")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    MIRO_CLIENT_ID: str = os.getenv("MIRO_CLIENT_ID", "3458764660706404976")
    MIRO_CLIENT_SECRET: str = os.getenv("MIRO_CLIENT_SECRET", "F9K8AcKSmtKxQVpLF72m4bCVGTPPjq9b")
    MIRO_REDIRECT_URI: str = os.getenv("MIRO_REDIRECT_URI", "http://localhost:8000/api/v1/miro/callback")
    MIRO_MCP_ENDPOINT: str = os.getenv("MIRO_MCP_ENDPOINT", "https://mcp.miro.com/")
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRICE_STARTER_MONTHLY: str = os.getenv("STRIPE_PRICE_STARTER_MONTHLY", "")
    STRIPE_PRICE_STARTER_ANNUAL: str = os.getenv("STRIPE_PRICE_STARTER_ANNUAL", "")
    STRIPE_PRICE_PRO_MONTHLY: str = os.getenv("STRIPE_PRICE_PRO_MONTHLY", "")
    STRIPE_PRICE_PRO_ANNUAL: str = os.getenv("STRIPE_PRICE_PRO_ANNUAL", "")

    # New: Comp.ly integration settings
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "comply-hackep")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")
    MCP_SERVER_PATH: str = os.getenv("MCP_SERVER_PATH", "../open-legal-compliance-mcp")
    GOVINFO_API_KEY: str = os.getenv("GOVINFO_API_KEY", "")
    COURTLISTENER_API_KEY: str = os.getenv("COURTLISTENER_API_KEY", "")
    CONGRESS_GOV_API_KEY: str = os.getenv("CONGRESS_GOV_API_KEY", "")
    OPEN_STATES_API_KEY: str = os.getenv("OPEN_STATES_API_KEY", "")

settings = Settings()
```

**Step 3: Install new deps**

```bash
cd backend && pip install -r requirements.txt
```

**Step 4: Commit**

```bash
git add backend/requirements.txt backend/app/core/config.py
git commit -m "feat: add Comp.ly dependencies and config settings"
```

---

### Task 3: Backend — add core modules (encryption, Firestore helper, CurrentUser auth)

**Files:**
- Create: `backend/app/core/encryption.py`
- Create: `backend/app/core/firestore.py`
- Create: `backend/app/core/auth_dep.py`

**Step 1: Create encryption.py**

```python
"""Symmetric encryption for storing GitHub tokens in Firestore."""
from cryptography.fernet import Fernet
from app.core.config import settings


def _get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        key = Fernet.generate_key().decode()
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()
```

**Step 2: Create firestore.py**

This provides the Firestore client, reusing the Firebase Admin SDK that `security.py` already initializes:

```python
"""Firestore client — reuses Firebase Admin SDK from security.py."""
from google.cloud import firestore
from app.core.security import ensure_firebase_initialized


def get_db() -> firestore.Client:
    ensure_firebase_initialized()
    return firestore.Client()
```

**Step 3: Create auth_dep.py**

This adds the `CurrentUser` class with `consultancy_id` lookup, building on the existing `get_current_user` from `security.py`:

```python
"""Extended auth dependency with consultancy context."""
from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user
from app.core.firestore import get_db


class CurrentUser:
    def __init__(self, uid: str, email: str, consultancy_id: str | None):
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
```

**Step 4: Commit**

```bash
git add backend/app/core/encryption.py backend/app/core/firestore.py backend/app/core/auth_dep.py
git commit -m "feat: add encryption, Firestore client, and consultancy auth dependency"
```

---

### Task 4: Backend — add new Pydantic schemas

**Files:**
- Modify: `backend/app/models/schemas.py`

**Step 1: Append Comp.ly schemas to existing schemas.py**

Add the following to the end of `backend/app/models/schemas.py` (after the existing `EnterpriseContactRequest` class):

```python
# ── Comp.ly Integration: Enums ────────────────────────────────────

from enum import Enum

class ComplianceFramework(str, Enum):
    GDPR = "GDPR"
    DORA = "DORA"
    ISO27001 = "ISO27001"
    SOC2 = "SOC2"
    HIPAA = "HIPAA"
    PCI_DSS = "PCI-DSS"

class CloudProvider(str, Enum):
    AWS = "AWS"
    AZURE = "Azure"
    GCP = "GCP"
    MULTI_CLOUD = "Multi-Cloud"

class InfrastructureType(str, Enum):
    TERRAFORM = "Terraform"
    KUBERNETES = "Kubernetes"
    CLOUDFORMATION = "CloudFormation"
    MIXED = "Mixed"

class Severity(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"


# ── Comp.ly Integration: Consultancy ──────────────────────────────

class CreateConsultancyRequest(BaseModel):
    name: str

class ConsultancyResponse(BaseModel):
    id: str
    name: str
    created_by: str
    plan: str
    created_at: str


# ── Comp.ly Integration: Workspace ────────────────────────────────

class CreateWorkspaceRequest(BaseModel):
    client_name: str
    client_industry: str
    compliance_frameworks: List[ComplianceFramework]
    cloud_provider: CloudProvider
    infrastructure_type: InfrastructureType

class WorkspaceResponse(BaseModel):
    id: str
    consultancy_id: str
    client_name: str
    client_industry: str
    compliance_frameworks: List[str]
    cloud_provider: str
    infrastructure_type: str
    status: str
    created_by: str
    created_at: str


# ── Comp.ly Integration: GitHub (workspace-scoped) ────────────────

class GitHubConnectRequest(BaseModel):
    code: str
    redirect_uri: str

class ConnectRepoRequest(BaseModel):
    full_name: str
    default_branch: str = "main"


# ── Comp.ly Integration: Scan (workspace-scoped) ─────────────────

class TriggerScanRequest(BaseModel):
    repo_id: str

class ScanSummary(BaseModel):
    total_findings: int = 0
    p0: int = 0
    p1: int = 0
    p2: int = 0

class WorkspaceScanResponse(BaseModel):
    id: str
    repo_id: str
    commit_sha: str
    status: str
    triggered_by: str
    started_at: str
    completed_at: Optional[str] = None
    summary: Optional[ScanSummary] = None


# ── Comp.ly Integration: Findings & Plans ─────────────────────────

class FindingSchema(BaseModel):
    severity: Severity
    rule_id: str
    regulation_ref: str
    title: str
    description: str
    file_path: str
    line_start: int
    line_end: int
    evidence: str
    confidence: float

class ApprovePlanResponse(BaseModel):
    plan_id: str
    approved: bool
    approved_by: str


# ── Comp.ly Integration: Document ─────────────────────────────────

class DocumentMetadata(BaseModel):
    id: str
    name: str
    storage_path: str
    download_url: str
    size: int
    content_type: str
    uploaded_by: str
    uploaded_at: str
```

**Step 2: Commit**

```bash
git add backend/app/models/schemas.py
git commit -m "feat: add Comp.ly schemas (consultancy, workspace, documents, findings)"
```

---

### Task 5: Backend — add new route files

**Files:**
- Create: `backend/app/routes/consultancies.py`
- Create: `backend/app/routes/workspaces.py`
- Create: `backend/app/routes/workspace_github.py`
- Create: `backend/app/routes/workspace_scans.py`
- Create: `backend/app/routes/plans.py`
- Create: `backend/app/routes/documents.py`

**Step 1: Create consultancies.py**

```python
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
```

**Step 2: Create workspaces.py**

```python
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
```

**Step 3: Create workspace_github.py**

```python
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
```

**Step 4: Create workspace_scans.py**

```python
"""Scan router — trigger scans and read results (workspace-scoped)."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from app.core.auth_dep import require_consultancy, CurrentUser
from app.core.firestore import get_db
from app.models.schemas import TriggerScanRequest

router = APIRouter(tags=["workspace-scans"])


def _assert_workspace_access(workspace_id: str, user: CurrentUser) -> dict:
    db = get_db()
    doc = db.collection("workspaces").document(workspace_id).get()
    if not doc.exists:
        raise HTTPException(404, "Workspace not found")
    data = doc.to_dict()
    if data.get("consultancyId") != user.consultancy_id:
        raise HTTPException(403, "Forbidden")
    return data


@router.post("/workspaces/{workspace_id}/scans", status_code=202)
async def trigger_scan(
    workspace_id: str,
    body: TriggerScanRequest,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()

    repo_doc = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("repos")
        .document(body.repo_id)
        .get()
    )
    if not repo_doc.exists:
        raise HTTPException(404, "Repo not found")

    now = datetime.now(timezone.utc).isoformat()
    scan_ref = (
        db.collection("workspaces").document(workspace_id).collection("scans").document()
    )
    scan_ref.set(
        {
            "repoId": body.repo_id,
            "commitSha": "HEAD",
            "status": "queued",
            "triggeredBy": user.uid,
            "startedAt": now,
        }
    )

    return {"scanId": scan_ref.id, "status": "queued"}


@router.get("/workspaces/{workspace_id}/scans/{scan_id}")
async def get_scan(
    workspace_id: str,
    scan_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    doc = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("scans")
        .document(scan_id)
        .get()
    )
    if not doc.exists:
        raise HTTPException(404, "Scan not found")
    data = doc.to_dict()
    return {"id": doc.id, **data}


@router.get("/workspaces/{workspace_id}/scans/{scan_id}/findings")
async def list_findings(
    workspace_id: str,
    scan_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    findings = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("scans")
        .document(scan_id)
        .collection("findings")
        .stream()
    )
    return [{"id": f.id, **f.to_dict()} for f in findings]


@router.get("/workspaces/{workspace_id}/scans/{scan_id}/plans")
async def list_plans(
    workspace_id: str,
    scan_id: str,
    user: CurrentUser = Depends(require_consultancy),
):
    _assert_workspace_access(workspace_id, user)
    db = get_db()
    plans = (
        db.collection("workspaces")
        .document(workspace_id)
        .collection("scans")
        .document(scan_id)
        .collection("plans")
        .stream()
    )
    return [{"id": p.id, **p.to_dict()} for p in plans]
```

**Step 5: Create plans.py**

```python
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
```

**Step 6: Create documents.py**

```python
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
```

**Step 7: Commit**

```bash
git add backend/app/routes/consultancies.py backend/app/routes/workspaces.py backend/app/routes/workspace_github.py backend/app/routes/workspace_scans.py backend/app/routes/plans.py backend/app/routes/documents.py
git commit -m "feat: add Comp.ly backend routers (consultancies, workspaces, docs, scans)"
```

---

### Task 6: Backend — register new routes in router.py

**Files:**
- Modify: `backend/app/api/router.py`

**Step 1: Update router.py**

Replace contents of `backend/app/api/router.py` with:

```python
from fastapi import APIRouter
from app.api.v1 import auth
from app.routes import (
    scan, fixes, legal, github, chat, billing, miro,
    consultancies, workspaces, workspace_github, workspace_scans, plans, documents,
)

router = APIRouter()

# Existing routes
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(scan.router, tags=["scan"])
router.include_router(fixes.router, tags=["fixes"])
router.include_router(legal.router, tags=["legal"])
router.include_router(github.router, prefix="/github", tags=["github"])
router.include_router(chat.router, tags=["chat"])
router.include_router(billing.router, tags=["billing"])
router.include_router(miro.router, prefix="/miro", tags=["miro"])

# Comp.ly integration routes
router.include_router(consultancies.router, tags=["consultancies"])
router.include_router(workspaces.router, tags=["workspaces"])
router.include_router(workspace_github.router, tags=["workspace-github"])
router.include_router(workspace_scans.router, tags=["workspace-scans"])
router.include_router(plans.router, tags=["workspace-plans"])
router.include_router(documents.router, tags=["documents"])
```

**Step 2: Commit**

```bash
git add backend/app/api/router.py
git commit -m "feat: register Comp.ly routes in API router"
```

---

### Task 7: Frontend — add types, Firestore helpers, Storage helpers, API client

**Files:**
- Create: `comply-landing/src/types/comply.ts`
- Create: `comply-landing/src/lib/firestore.ts`
- Create: `comply-landing/src/lib/storage.ts`
- Create: `comply-landing/src/lib/api.ts`

**Step 1: Create TypeScript types**

Create `comply-landing/src/types/comply.ts`:

```typescript
export interface Consultancy {
  id: string;
  name: string;
  createdBy: string;
  plan: string;
  createdAt: string;
}

export type ComplianceFramework = "GDPR" | "DORA" | "ISO27001" | "SOC2" | "HIPAA" | "PCI-DSS";
export type CloudProvider = "AWS" | "Azure" | "GCP" | "Multi-Cloud";
export type InfrastructureType = "Terraform" | "Kubernetes" | "CloudFormation" | "Mixed";
export type Severity = "P0" | "P1" | "P2";
export type ScanStatus = "queued" | "running" | "completed" | "failed";

export interface Workspace {
  id: string;
  consultancy_id: string;
  client_name: string;
  client_industry: string;
  compliance_frameworks: ComplianceFramework[];
  cloud_provider: CloudProvider;
  infrastructure_type: InfrastructureType;
  status: string;
  created_by: string;
  created_at: string;
  githubUsername?: string;
}

export interface Repo {
  id: string;
  fullName: string;
  defaultBranch: string;
  connectedAt: string;
  isActive: boolean;
}

export interface WorkspaceScan {
  id: string;
  repoId: string;
  commitSha: string;
  status: ScanStatus;
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  summary?: {
    totalFindings: number;
    p0: number;
    p1: number;
    p2: number;
  };
}

export interface Finding {
  id: string;
  severity: Severity;
  ruleId: string;
  regulationRef: string;
  title: string;
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  evidence: string;
  confidence: number;
}

export interface FixPlan {
  id: string;
  findingId: string;
  planText: string;
  targetFiles: string[];
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

export interface WorkspaceDocument {
  id: string;
  name: string;
  storagePath: string;
  downloadURL: string;
  size: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: string;
}
```

**Step 2: Create API client**

Create `comply-landing/src/lib/api.ts`:

```typescript
import { auth } from "./firebase";
import type {
  Consultancy,
  Workspace,
  WorkspaceScan,
  Finding,
  FixPlan,
  WorkspaceDocument,
} from "@/types/comply";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Consultancies ──────────────────────────────────────────────────

export async function createConsultancy(name: string): Promise<Consultancy> {
  return apiFetch("/consultancies", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getConsultancy(id: string): Promise<Consultancy> {
  return apiFetch(`/consultancies/${id}`);
}

// ── Workspaces ─────────────────────────────────────────────────────

export async function listWorkspaces(): Promise<Workspace[]> {
  return apiFetch("/workspaces");
}

export async function createWorkspace(data: {
  client_name: string;
  client_industry: string;
  compliance_frameworks: string[];
  cloud_provider: string;
  infrastructure_type: string;
}): Promise<Workspace> {
  return apiFetch("/workspaces", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getWorkspace(id: string): Promise<Workspace> {
  return apiFetch(`/workspaces/${id}`);
}

// ── Workspace GitHub ───────────────────────────────────────────────

export async function connectWorkspaceGitHub(
  workspaceId: string,
  code: string,
  redirectUri: string
): Promise<{ connected: boolean; githubUsername: string }> {
  return apiFetch(`/workspaces/${workspaceId}/github/connect`, {
    method: "POST",
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
}

export async function listWorkspaceGitHubRepos(
  workspaceId: string
): Promise<{ repos: { full_name: string; default_branch: string }[] }> {
  return apiFetch(`/workspaces/${workspaceId}/github/repos`);
}

export async function connectWorkspaceRepo(
  workspaceId: string,
  fullName: string,
  defaultBranch: string = "main"
): Promise<{ id: string }> {
  return apiFetch(`/workspaces/${workspaceId}/repos`, {
    method: "POST",
    body: JSON.stringify({ full_name: fullName, default_branch: defaultBranch }),
  });
}

// ── Workspace Scans ────────────────────────────────────────────────

export async function triggerWorkspaceScan(
  workspaceId: string,
  repoId: string
): Promise<{ scanId: string; status: string }> {
  return apiFetch(`/workspaces/${workspaceId}/scans`, {
    method: "POST",
    body: JSON.stringify({ repo_id: repoId }),
  });
}

export async function getWorkspaceScan(
  workspaceId: string,
  scanId: string
): Promise<WorkspaceScan> {
  return apiFetch(`/workspaces/${workspaceId}/scans/${scanId}`);
}

export async function listScanFindings(
  workspaceId: string,
  scanId: string
): Promise<Finding[]> {
  return apiFetch(`/workspaces/${workspaceId}/scans/${scanId}/findings`);
}

export async function listScanPlans(
  workspaceId: string,
  scanId: string
): Promise<FixPlan[]> {
  return apiFetch(`/workspaces/${workspaceId}/scans/${scanId}/plans`);
}

export async function approvePlan(
  workspaceId: string,
  scanId: string,
  planId: string
): Promise<{ planId: string; approved: boolean }> {
  return apiFetch(
    `/workspaces/${workspaceId}/scans/${scanId}/plans/${planId}/approve`,
    { method: "POST" }
  );
}

// ── Documents ──────────────────────────────────────────────────────

export async function listDocuments(
  workspaceId: string
): Promise<WorkspaceDocument[]> {
  return apiFetch(`/workspaces/${workspaceId}/documents`);
}

export async function deleteDocument(
  workspaceId: string,
  documentId: string
): Promise<void> {
  return apiFetch(`/workspaces/${workspaceId}/documents/${documentId}`, {
    method: "DELETE",
  });
}
```

**Step 3: Create Firestore helpers**

Create `comply-landing/src/lib/firestore.ts`:

```typescript
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import app from "./firebase";

const db = getFirestore(app);

function normalizeData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate().toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...normalizeData(snap.data()) };
}

export async function ensureUserDoc(uid: string, data: Record<string, unknown>) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...data, createdAt: new Date().toISOString() });
  }
  return { id: ref.id, ...(snap.exists() ? normalizeData(snap.data()) : data) };
}

export async function listWorkspaceDocuments(workspaceId: string) {
  const q = query(
    collection(db, "workspaces", workspaceId, "documents"),
    orderBy("uploadedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalizeData(d.data()) }));
}

export async function listWorkspaceRepos(workspaceId: string) {
  const q = query(
    collection(db, "workspaces", workspaceId, "repos"),
    orderBy("connectedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...normalizeData(d.data()) }));
}

export { db };
```

**Step 4: Create Storage helpers**

Create `comply-landing/src/lib/storage.ts`:

```typescript
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import app from "./firebase";
import { db } from "./firestore";

const storage = getStorage(app);

export async function uploadWorkspaceDocument(
  workspaceId: string,
  file: File,
  uploadedBy: string,
  onProgress?: (pct: number) => void
): Promise<{ downloadURL: string; storagePath: string; docId: string }> {
  const timestamp = Date.now();
  const storagePath = `workspaces/${workspaceId}/documents/${timestamp}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        onProgress?.(pct);
      },
      reject,
      async () => {
        const downloadURL = await getDownloadURL(task.snapshot.ref);

        const docRef = doc(db, "workspaces", workspaceId, "documents", `${timestamp}`);
        await setDoc(docRef, {
          name: file.name,
          storagePath,
          downloadURL,
          size: file.size,
          contentType: file.type,
          uploadedBy,
          uploadedAt: new Date().toISOString(),
        });

        resolve({ downloadURL, storagePath, docId: docRef.id });
      }
    );
  });
}

export async function deleteStorageFile(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}
```

**Step 5: Install Firebase Firestore on frontend**

The frontend `package.json` already has `firebase` which includes Firestore. No additional installs needed.

**Step 6: Commit**

```bash
git add comply-landing/src/types/comply.ts comply-landing/src/lib/api.ts comply-landing/src/lib/firestore.ts comply-landing/src/lib/storage.ts
git commit -m "feat: add frontend types, API client, Firestore and Storage helpers"
```

---

### Task 8: Frontend — add workspace pages and components

**Files:**
- Create: `comply-landing/src/app/dashboard/workspaces/page.tsx`
- Create: `comply-landing/src/app/dashboard/workspaces/new/page.tsx`
- Create: `comply-landing/src/app/dashboard/workspaces/[id]/page.tsx`
- Create: `comply-landing/src/app/dashboard/workspaces/[id]/scans/[scanId]/page.tsx`

**Step 1: Create workspace list page** (`comply-landing/src/app/dashboard/workspaces/page.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Plus, Building2, Shield, Cloud } from "lucide-react";
import { listWorkspaces } from "@/lib/api";
import type { Workspace } from "@/types/comply";

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-warm-grey-900">
            Workspaces
          </h1>
          <p className="mt-1 text-sm text-warm-grey-600">
            Manage client workspaces and compliance scans.
          </p>
        </div>
        <Link
          href="/dashboard/workspaces/new"
          className="inline-flex items-center gap-2 rounded-xl bg-warm-brown-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-warm-brown-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Workspace
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-warm-grey-100" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-warm-grey-300 p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-warm-grey-400" />
          <p className="mt-3 text-warm-grey-600">No workspaces yet.</p>
          <Link
            href="/dashboard/workspaces/new"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-warm-brown-600 hover:text-warm-brown-700"
          >
            <Plus className="h-4 w-4" /> Create your first workspace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Link key={ws.id} href={`/dashboard/workspaces/${ws.id}`}>
              <div className="group rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6 hover:border-warm-brown-300/60 transition-colors">
                <h3 className="font-display text-lg font-bold text-warm-grey-900">
                  {ws.client_name}
                </h3>
                <p className="mt-1 text-sm text-warm-grey-500">{ws.client_industry}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {ws.compliance_frameworks.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 rounded-full bg-warm-brown-100 px-2 py-0.5 text-xs font-medium text-warm-brown-700"
                    >
                      <Shield className="h-3 w-3" />
                      {f}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-warm-grey-400">
                  <Cloud className="h-3 w-3" />
                  {ws.cloud_provider} · {ws.infrastructure_type}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
```

**Step 2: Create new workspace page** (`comply-landing/src/app/dashboard/workspaces/new/page.tsx`)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { createWorkspace } from "@/lib/api";
import type { ComplianceFramework, CloudProvider, InfrastructureType } from "@/types/comply";

const FRAMEWORKS: ComplianceFramework[] = ["GDPR", "DORA", "ISO27001", "SOC2", "HIPAA", "PCI-DSS"];
const CLOUDS: CloudProvider[] = ["AWS", "Azure", "GCP", "Multi-Cloud"];
const INFRA_TYPES: InfrastructureType[] = ["Terraform", "Kubernetes", "CloudFormation", "Mixed"];

export default function NewWorkspacePage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientIndustry, setClientIndustry] = useState("");
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [cloud, setCloud] = useState<CloudProvider>("AWS");
  const [infra, setInfra] = useState<InfrastructureType>("Terraform");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleFramework = (f: ComplianceFramework) => {
    setFrameworks((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientIndustry || frameworks.length === 0) {
      setError("Please fill all fields and select at least one framework.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const ws = await createWorkspace({
        client_name: clientName,
        client_industry: clientIndustry,
        compliance_frameworks: frameworks,
        cloud_provider: cloud,
        infrastructure_type: infra,
      });
      router.push(`/dashboard/workspaces/${ws.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div>
        <h1 className="font-display text-2xl font-bold text-warm-grey-900">
          Create Workspace
        </h1>
        <p className="mt-1 text-sm text-warm-grey-600">
          Set up a new client workspace for compliance scanning.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
          <div>
            <label className="block text-sm font-medium text-warm-grey-700 mb-1">
              Client Name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm focus:border-warm-brown-400 focus:outline-none focus:ring-1 focus:ring-warm-brown-400"
              placeholder="Acme Corp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-grey-700 mb-1">
              Industry
            </label>
            <input
              type="text"
              value={clientIndustry}
              onChange={(e) => setClientIndustry(e.target.value)}
              className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm focus:border-warm-brown-400 focus:outline-none focus:ring-1 focus:ring-warm-brown-400"
              placeholder="Financial Services"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-grey-700 mb-2">
              Compliance Frameworks
            </label>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFramework(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    frameworks.includes(f)
                      ? "bg-warm-brown-500 text-white"
                      : "bg-warm-grey-100 text-warm-grey-600 hover:bg-warm-grey-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-warm-grey-700 mb-1">
                Cloud Provider
              </label>
              <select
                value={cloud}
                onChange={(e) => setCloud(e.target.value as CloudProvider)}
                className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm focus:border-warm-brown-400 focus:outline-none"
              >
                {CLOUDS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-grey-700 mb-1">
                Infrastructure Type
              </label>
              <select
                value={infra}
                onChange={(e) => setInfra(e.target.value as InfrastructureType)}
                className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm focus:border-warm-brown-400 focus:outline-none"
              >
                {INFRA_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-warm-brown-500 py-3 text-sm font-semibold text-white hover:bg-warm-brown-600 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating..." : "Create Workspace"}
        </button>
      </form>
    </motion.div>
  );
}
```

**Step 3: Create workspace detail page** (`comply-landing/src/app/dashboard/workspaces/[id]/page.tsx`)

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Shield, Cloud, GitBranch, FileText, Play, Upload,
  ChevronRight, Trash2,
} from "lucide-react";
import { getWorkspace, listWorkspaceGitHubRepos, connectWorkspaceRepo, triggerWorkspaceScan } from "@/lib/api";
import { listWorkspaceRepos, listWorkspaceDocuments } from "@/lib/firestore";
import { uploadWorkspaceDocument, deleteStorageFile } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import type { Workspace, WorkspaceDocument } from "@/types/comply";

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [tab, setTab] = useState<"overview" | "repos" | "documents">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [ws, repoList, docList] = await Promise.all([
        getWorkspace(id),
        listWorkspaceRepos(id),
        listWorkspaceDocuments(id),
      ]);
      setWorkspace(ws);
      setRepos(repoList);
      setDocuments(docList as WorkspaceDocument[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      await uploadWorkspaceDocument(id, file, user.uid, setUploadProgress);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleScan = async (repoId: string) => {
    try {
      const result = await triggerWorkspaceScan(id, repoId);
      alert(`Scan started: ${result.scanId}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 rounded-2xl bg-warm-grey-100" />;
  }

  if (!workspace) {
    return <div className="text-red-600">{error || "Workspace not found"}</div>;
  }

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "repos" as const, label: "Repositories" },
    { key: "documents" as const, label: "Documents" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <Link
          href="/dashboard/workspaces"
          className="text-sm text-warm-grey-500 hover:text-warm-grey-700 mb-2 inline-block"
        >
          Workspaces
        </Link>
        <ChevronRight className="inline h-3 w-3 mx-1 text-warm-grey-400" />
        <span className="text-sm text-warm-grey-700">{workspace.client_name}</span>
        <h1 className="mt-2 font-display text-2xl font-bold text-warm-grey-900">
          {workspace.client_name}
        </h1>
        <p className="mt-1 text-sm text-warm-grey-500">{workspace.client_industry}</p>
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2">
        {workspace.compliance_frameworks.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 rounded-full bg-warm-brown-100 px-2.5 py-1 text-xs font-medium text-warm-brown-700">
            <Shield className="h-3 w-3" />{f}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full bg-warm-grey-100 px-2.5 py-1 text-xs font-medium text-warm-grey-600">
          <Cloud className="h-3 w-3" />{workspace.cloud_provider}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-warm-grey-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-warm-brown-500 text-warm-brown-600"
                : "text-warm-grey-500 hover:text-warm-grey-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-5">
            <p className="text-xs text-warm-grey-500 uppercase tracking-wider">Repositories</p>
            <p className="mt-1 text-2xl font-bold text-warm-grey-900">{repos.length}</p>
          </div>
          <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-5">
            <p className="text-xs text-warm-grey-500 uppercase tracking-wider">Documents</p>
            <p className="mt-1 text-2xl font-bold text-warm-grey-900">{documents.length}</p>
          </div>
          <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-5">
            <p className="text-xs text-warm-grey-500 uppercase tracking-wider">Status</p>
            <p className="mt-1 text-2xl font-bold text-green-600 capitalize">{workspace.status}</p>
          </div>
        </div>
      )}

      {tab === "repos" && (
        <div className="space-y-4">
          {repos.length === 0 ? (
            <p className="text-sm text-warm-grey-500">No repositories connected yet.</p>
          ) : (
            repos.map((repo: any) => (
              <div key={repo.id} className="flex items-center justify-between rounded-xl border border-warm-grey-200 bg-warm-grey-50 p-4">
                <div className="flex items-center gap-3">
                  <GitBranch className="h-5 w-5 text-warm-grey-400" />
                  <div>
                    <p className="text-sm font-medium text-warm-grey-900">{repo.fullName}</p>
                    <p className="text-xs text-warm-grey-500">{repo.defaultBranch}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleScan(repo.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-warm-brown-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-warm-brown-600 transition-colors"
                >
                  <Play className="h-3 w-3" /> Scan
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-warm-grey-300 p-8 hover:border-warm-brown-400 transition-colors">
            <Upload className="h-5 w-5 text-warm-grey-400" />
            <span className="text-sm text-warm-grey-600">
              {uploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Drop a file or click to upload"}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.xlsx,.csv,.txt,.json,.yaml,.yml"
              disabled={uploading}
            />
          </label>

          {documents.length === 0 ? (
            <p className="text-sm text-warm-grey-500">No documents uploaded yet.</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-xl border border-warm-grey-200 bg-warm-grey-50 p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-warm-grey-400" />
                  <div>
                    <a href={doc.downloadURL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-warm-brown-600 hover:underline">
                      {doc.name}
                    </a>
                    <p className="text-xs text-warm-grey-500">{(doc.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </motion.div>
  );
}
```

**Step 4: Create workspace scan results page** (`comply-landing/src/app/dashboard/workspaces/[id]/scans/[scanId]/page.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { getWorkspaceScan, listScanFindings, listScanPlans, approvePlan } from "@/lib/api";
import type { WorkspaceScan, Finding, FixPlan } from "@/types/comply";

const severityColor: Record<string, string> = {
  P0: "bg-red-100 text-red-700 border-red-200",
  P1: "bg-orange-100 text-orange-700 border-orange-200",
  P2: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

export default function WorkspaceScanPage() {
  const { id: workspaceId, scanId } = useParams<{ id: string; scanId: string }>();
  const [scan, setScan] = useState<WorkspaceScan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [plans, setPlans] = useState<FixPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, f, p] = await Promise.all([
          getWorkspaceScan(workspaceId, scanId),
          listScanFindings(workspaceId, scanId),
          listScanPlans(workspaceId, scanId),
        ]);
        setScan(s);
        setFindings(f);
        setPlans(p);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [workspaceId, scanId]);

  const handleApprove = async (planId: string) => {
    await approvePlan(workspaceId, scanId, planId);
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, approved: true } : p))
    );
  };

  if (loading) return <div className="animate-pulse h-64 rounded-2xl bg-warm-grey-100" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Breadcrumb */}
      <div className="text-sm text-warm-grey-500">
        <Link href="/dashboard/workspaces" className="hover:text-warm-grey-700">Workspaces</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <Link href={`/dashboard/workspaces/${workspaceId}`} className="hover:text-warm-grey-700">Workspace</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <span className="text-warm-grey-700">Scan</span>
      </div>

      {/* Scan status */}
      <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
        <div className="flex items-center gap-3">
          {scan?.status === "completed" ? (
            <CheckCircle className="h-6 w-6 text-green-500" />
          ) : scan?.status === "failed" ? (
            <AlertTriangle className="h-6 w-6 text-red-500" />
          ) : (
            <Clock className="h-6 w-6 text-warm-brown-500 animate-pulse" />
          )}
          <div>
            <h2 className="font-display text-xl font-bold text-warm-grey-900 capitalize">
              Scan {scan?.status}
            </h2>
            <p className="text-sm text-warm-grey-500">Started {scan?.startedAt}</p>
          </div>
        </div>
        {scan?.summary && (
          <div className="mt-4 flex gap-3">
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
              P0: {scan.summary.p0}
            </span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              P1: {scan.summary.p1}
            </span>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
              P2: {scan.summary.p2}
            </span>
          </div>
        )}
      </div>

      {/* Findings */}
      <div>
        <h3 className="font-display text-lg font-bold text-warm-grey-900 mb-4">
          Findings ({findings.length})
        </h3>
        <div className="space-y-3">
          {findings.map((f) => {
            const plan = plans.find((p) => p.findingId === f.id);
            return (
              <div key={f.id} className="rounded-xl border border-warm-grey-200 bg-warm-grey-50 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${severityColor[f.severity]}`}>
                        {f.severity}
                      </span>
                      <span className="text-xs text-warm-grey-400 font-mono">{f.regulationRef}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-warm-grey-900">{f.title}</h4>
                    <p className="mt-1 text-xs text-warm-grey-600">{f.description}</p>
                    <p className="mt-1 text-xs text-warm-grey-400 font-mono">{f.filePath}:{f.lineStart}</p>
                  </div>
                  {plan && !plan.approved && (
                    <button
                      onClick={() => handleApprove(plan.id)}
                      className="ml-4 rounded-lg bg-warm-brown-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-warm-brown-600 transition-colors"
                    >
                      Approve Fix
                    </button>
                  )}
                  {plan?.approved && (
                    <span className="ml-4 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      Approved
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
```

**Step 5: Commit**

```bash
git add comply-landing/src/app/dashboard/workspaces/
git commit -m "feat: add workspace pages (list, create, detail, scan results)"
```

---

### Task 9: Frontend — update dashboard with workspaces navigation

**Files:**
- Modify: `comply-landing/src/app/dashboard/layout.tsx`
- Modify: `comply-landing/src/app/dashboard/page.tsx`

**Step 1: Add Workspaces link to TopNav in dashboard layout**

In `comply-landing/src/app/dashboard/layout.tsx`, add a "Workspaces" link after the Logo link:

After the `<Link href="/" ...>Comply</Link>` element (around line 46), add a nav section:

```tsx
{/* Nav links */}
<nav className="hidden sm:flex items-center gap-4 ml-8">
  <Link href="/dashboard" className="text-sm text-warm-grey-600 hover:text-warm-grey-900 transition-colors">
    Dashboard
  </Link>
  <Link href="/dashboard/workspaces" className="text-sm text-warm-grey-600 hover:text-warm-grey-900 transition-colors">
    Workspaces
  </Link>
</nav>
```

**Step 2: Add workspaces section to dashboard page**

In `comply-landing/src/app/dashboard/page.tsx`, add a "Workspaces" link/card above or alongside the existing RepoConnect and MiroConnect:

Add after the `<p className="mt-1 ...">` description paragraph:

```tsx
{/* Quick link to Workspaces */}
<div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6 hover:border-warm-brown-300/60 transition-colors">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-display text-lg font-bold text-warm-grey-900">Document Compliance</h3>
      <p className="mt-1 text-sm text-warm-grey-600">
        Create workspaces, upload documents, and scan for regulatory compliance.
      </p>
    </div>
    <a
      href="/dashboard/workspaces"
      className="inline-flex items-center gap-2 rounded-xl bg-warm-brown-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-warm-brown-600 transition-colors"
    >
      Open Workspaces
    </a>
  </div>
</div>
```

**Step 3: Commit**

```bash
git add comply-landing/src/app/dashboard/layout.tsx comply-landing/src/app/dashboard/page.tsx
git commit -m "feat: add workspaces navigation to dashboard"
```

---

### Task 10: Frontend — update landing page sections

**Files:**
- Modify: `comply-landing/src/components/sections/HeroSection.tsx`
- Modify: `comply-landing/src/components/sections/HowItWorksSection.tsx`

**Step 1: Update HeroSection**

In `HeroSection.tsx`, update the description paragraph (around line 100) to mention documentation compliance:

Change:
```
Connect your GitHub repo and a team of AI agents audits, plans,
and fixes your infrastructure automatically — in minutes, not months.
```

To:
```
Connect your GitHub repo or upload compliance documents — a team of AI agents audits your infrastructure and documentation, plans remediation, and ships fixes automatically.
```

Also update the social trust tags (around line 112) to include "DORA" and "HIPAA":

```tsx
{["SOC 2", "ISO 27001", "GDPR", "DORA", "HIPAA", "PCI-DSS"].map((tag) => (
```

**Step 2: Update HowItWorksSection**

In `HowItWorksSection.tsx`, update step 1 description to mention documents:

Change step 1 description:
```
Securely link your GitHub repo via OAuth. No manual uploads, no config files — just click and connect.
```

To:
```
Link your GitHub repo via OAuth or upload compliance documents. Create workspaces per client with framework-specific scanning.
```

And update step 1 detail:
```
Supports monorepos, Terraform, Kubernetes, PDFs, and policy docs.
```

**Step 3: Commit**

```bash
git add comply-landing/src/components/sections/HeroSection.tsx comply-landing/src/components/sections/HowItWorksSection.tsx
git commit -m "feat: update landing page to highlight document compliance"
```

---

### Task 11: Verify backend starts and frontend compiles

**Step 1: Test backend starts**

```bash
cd /Users/mohammadtallab/Documents/GitHub/Comply/backend && python -c "from app.main import app; print('Backend imports OK')"
```

Expected: No import errors.

**Step 2: Test frontend builds**

```bash
cd /Users/mohammadtallab/Documents/GitHub/Comply/comply-landing && npx next build 2>&1 | tail -20
```

Expected: Build succeeds (or only warnings, no errors).

**Step 3: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: resolve integration build issues"
```
