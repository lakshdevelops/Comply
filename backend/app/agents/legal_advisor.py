from app.agents.gemini_client import invoke
from app.services.regulation_service import get_article_context

LEGAL_ADVISOR_SYSTEM_PROMPT = """You are a regulatory legal advisor specializing in financial technology compliance.

Your role: Explain regulations in plain language for a non-technical compliance officer.

Focus on:
1. What the regulation requires (obligations and standards)
2. Consequences of non-compliance (penalties, sanctions, operational impact)
3. Why the regulation exists (the risk or harm it aims to prevent)

Rules:
- Do NOT suggest technical fixes or remediation steps (that is the Strategist's job)
- Keep your explanation under 300 words
- Use clear, jargon-free language
- Reference the specific article and section being discussed"""


def run_legal_advisor(regulation_ref: str) -> str:
    """
    Provide a plain language explanation of a regulation.

    Args:
        regulation_ref: A regulation reference string (e.g. "DORA-Art9-3b").

    Returns:
        A plain language explanation of the regulation as a string.
    """
    context = get_article_context(regulation_ref)

    if context:
        user_content = (
            f"Regulation reference: {regulation_ref}\n\n"
            f"Regulatory text:\n{context}"
        )
    else:
        user_content = (
            f"Regulation reference: {regulation_ref}\n\n"
            f"No specific regulatory text was found for this reference. "
            f"Please explain this regulation based on your knowledge."
        )

    explanation = invoke(
        system_prompt=LEGAL_ADVISOR_SYSTEM_PROMPT,
        user_content=user_content,
        expect_json=False,
    )

    return explanation
