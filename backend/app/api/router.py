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
