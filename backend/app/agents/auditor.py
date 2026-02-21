import json
import uuid
from app.agents.gemini_client import invoke
from app.services.regulation_service import get_rules

AUDITOR_SYSTEM_PROMPT = """You are a regulatory compliance auditor for cloud infrastructure.

Your role: Scan infrastructure-as-code files for regulatory violations.
Your mode: READ-ONLY. Detect and report violations ONLY. Do NOT suggest fixes.

You will be given:
1. A set of compliance rules (below)
2. Infrastructure files to audit

RULESET:
{ruleset}

For each violation found, produce a JSON object with these exact fields:
- violation_id: a unique identifier (use format "V-<uuid-short>")
- rule_id: the rule_id from the ruleset that was violated
- severity: the severity from the matched rule (critical, high, medium, low)
- file: the filename where the violation was found
- line: approximate line number (integer) or null if unknown
- resource: the resource name/identifier in the file
- field: the specific field or configuration that is non-compliant
- current_value: the current value or "missing" if the field is absent
- description: a concise description of the violation
- regulation_ref: the regulation_ref from the matched rule

Output ONLY a valid JSON array of violation objects. No explanations, no markdown, no extra text."""

QA_RESCAN_NOTE = """
IMPORTANT: This is a QA re-scan after fixes have been applied.
Only report NEW or REMAINING violations. Do not re-report violations that have been properly fixed."""


def run_auditor(repo_files: dict[str, str], is_qa_rescan: bool = False) -> list[dict]:
    """
    Scan repository files against compliance rules and return a list of violations.

    Args:
        repo_files: Dict mapping filename to file content.
        is_qa_rescan: If True, append a note to only report new/remaining violations.

    Returns:
        List of violation dicts, each with a unique violation_id.
    """
    rules = get_rules()
    ruleset_json = json.dumps(rules, indent=2)

    system_prompt = AUDITOR_SYSTEM_PROMPT.format(ruleset=ruleset_json)
    if is_qa_rescan:
        system_prompt += QA_RESCAN_NOTE

    # Build user content from repo files
    file_sections = []
    for filename, content in repo_files.items():
        file_sections.append(f"--- FILE: {filename} ---\n{content}\n")
    user_content = "\n".join(file_sections)

    violations = invoke(system_prompt=system_prompt, user_content=user_content, expect_json=True)

    # Ensure each violation has a unique violation_id
    if isinstance(violations, list):
        for v in violations:
            if not v.get("violation_id"):
                v["violation_id"] = f"V-{uuid.uuid4().hex[:8]}"
    else:
        violations = []

    return violations


def run_auditor_streaming(repo_files: dict[str, str]):
    """
    Generator that yields SSE-compatible event dicts as it scans files.
    """
    from app.agents.gemini_client import invoke_streaming

    rules = get_rules()
    ruleset_json = json.dumps(rules, indent=2)
    system_prompt = AUDITOR_SYSTEM_PROMPT.format(ruleset=ruleset_json)

    filenames = list(repo_files.keys())
    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Auditor", "chunk": f"Scanning {len(filenames)} infrastructure files...\n"}
    }

    # Build user content
    file_sections = []
    for filename, content in repo_files.items():
        file_sections.append(f"--- FILE: {filename} ---\n{content}\n")
        yield {
            "event": "reasoning_chunk",
            "data": {"agent": "Auditor", "chunk": f"Reading {filename}...\n"}
        }
    user_content = "\n".join(file_sections)

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Auditor", "chunk": "Analyzing files against compliance ruleset...\n"}
    }

    # Stream Gemini reasoning
    full_response = ""
    for chunk in invoke_streaming(system_prompt=system_prompt, user_content=user_content):
        full_response += chunk
        yield {
            "event": "reasoning_chunk",
            "data": {"agent": "Auditor", "chunk": chunk}
        }

    # Parse violations from complete response
    text = full_response.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]).strip()

    try:
        violations = json.loads(text)
    except json.JSONDecodeError:
        violations = []

    if isinstance(violations, list):
        for v in violations:
            if not v.get("violation_id"):
                v["violation_id"] = f"V-{uuid.uuid4().hex[:8]}"
            yield {
                "event": "violation_found",
                "data": {"agent": "Auditor", "violation": v}
            }
    else:
        violations = []

    yield {
        "event": "agent_complete",
        "data": {"agent": "Auditor", "summary": f"{len(violations)} violations detected", "violations": violations}
    }
