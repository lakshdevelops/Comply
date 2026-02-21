from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.schemas import LegalExplainRequest
from app.agents.legal_advisor import run_legal_advisor

router = APIRouter()


@router.post("/legal/explain")
def explain_regulation(
    req: LegalExplainRequest, user: dict = Depends(get_current_user)
):
    """Get a plain-language explanation of a regulation."""
    explanation = run_legal_advisor(req.regulation_ref)
    return {"regulation_ref": req.regulation_ref, "explanation": explanation}
