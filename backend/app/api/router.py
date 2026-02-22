from fastapi import APIRouter
from app.api.v1 import auth
from app.routes import scan, fixes, legal, github, chat, billing, miro

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(scan.router, tags=["scan"])
router.include_router(fixes.router, tags=["fixes"])
router.include_router(legal.router, tags=["legal"])
router.include_router(github.router, prefix="/github", tags=["github"])
router.include_router(chat.router, tags=["chat"])
router.include_router(billing.router, tags=["billing"])
router.include_router(miro.router, prefix="/miro", tags=["miro"])
