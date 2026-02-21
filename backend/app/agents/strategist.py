import json
from app.agents.gemini_client import invoke
from app.services.regulation_service import get_article_context

STRATEGIST_SYSTEM_PROMPT = """You are a compliance remediation strategist.

Your role: Produce detailed remediation plans for regulatory violations found in infrastructure code.

You will be given a list of violations, each enriched with regulatory context.

For each violation, produce a remediation plan JSON object with these exact fields:
- violation_id: must match the violation_id from the input
- file: the file where the violation was found
- explanation: plain language explanation of the violation for a non-technical compliance officer
- regulation_citation: the specific regulatory text that requires compliance
- what_needs_to_change: plain language description of the fix needed
- sample_fix: an illustrative code snippet showing the corrected configuration
- estimated_effort: estimated effort (e.g. "1 story point", "2 hours")
- priority: one of P0 (immediate), P1 (within sprint), P2 (next sprint)

Output ONLY a valid JSON array of remediation plan objects. No explanations, no markdown, no extra text."""


def run_strategist(violations: list[dict]) -> list[dict]:
    """
    Produce remediation plans for a list of violations.

    Each violation is enriched with regulatory context before being sent to Gemini.

    Args:
        violations: List of violation dicts from the auditor.

    Returns:
        List of remediation plan dicts.
    """
    # Enrich violations with regulatory context
    enriched = []
    for v in violations:
        entry = dict(v)
        regulation_ref = v.get("regulation_ref", "")
        if regulation_ref:
            context = get_article_context(regulation_ref)
            if context:
                entry["regulatory_context"] = context
        enriched.append(entry)

    user_content = json.dumps(enriched, indent=2)

    plans = invoke(system_prompt=STRATEGIST_SYSTEM_PROMPT, user_content=user_content, expect_json=True)

    if not isinstance(plans, list):
        plans = []

    return plans


def run_strategist_streaming(violations: list[dict]):
    """
    Generator that yields SSE-compatible event dicts as it builds remediation plans.
    """
    from app.agents.gemini_client import invoke_streaming

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Strategist", "chunk": f"Building remediation plans for {len(violations)} violations...\n"}
    }

    # Enrich violations with regulatory context
    enriched = []
    for v in violations:
        entry = dict(v)
        regulation_ref = v.get("regulation_ref", "")
        if regulation_ref:
            context = get_article_context(regulation_ref)
            if context:
                entry["regulatory_context"] = context
            yield {
                "event": "reasoning_chunk",
                "data": {"agent": "Strategist", "chunk": f"Enriching violation {v.get('violation_id', '?')} with {regulation_ref} context...\n"}
            }
        enriched.append(entry)

    user_content = json.dumps(enriched, indent=2)

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Strategist", "chunk": "Generating remediation strategies...\n"}
    }

    # Stream Gemini reasoning
    full_response = ""
    for chunk in invoke_streaming(system_prompt=STRATEGIST_SYSTEM_PROMPT, user_content=user_content):
        full_response += chunk
        yield {
            "event": "reasoning_chunk",
            "data": {"agent": "Strategist", "chunk": chunk}
        }

    # Parse plans from complete response
    text = full_response.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]).strip()

    try:
        plans = json.loads(text)
    except json.JSONDecodeError:
        plans = []

    if not isinstance(plans, list):
        plans = []

    for p in plans:
        yield {
            "event": "plan_ready",
            "data": {"agent": "Strategist", "plan": p}
        }

    yield {
        "event": "agent_complete",
        "data": {"agent": "Strategist", "summary": f"{len(plans)} remediation plans produced", "plans": plans}
    }
