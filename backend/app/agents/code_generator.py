import json
from app.agents.gemini_client import invoke

CODE_GENERATOR_SYSTEM_PROMPT = """You are a compliance code generator.

Your role: Generate a PRODUCTION-READY corrected version of an infrastructure file.

You will be given:
1. The file path and its original content
2. A list of approved remediation plans to apply

Instructions:
- Apply ALL approved remediation plans to the file
- Preserve ALL existing functionality that is not related to the violations
- Maintain the same file format, style, and conventions
- Ensure the corrected file is syntactically valid
- Output ONLY the COMPLETE corrected file content
- Do NOT include any explanations, comments about changes, or markdown code fences
- Do NOT wrap the output in ``` or any other markers
- The output should be the raw file content, ready to be written directly to disk"""


def run_code_generator(file_path: str, original_content: str, plans: list[dict]) -> str:
    """
    Generate a production-ready corrected version of a file.

    Args:
        file_path: Path to the file being corrected.
        original_content: The original content of the file.
        plans: List of approved remediation plan dicts to apply.

    Returns:
        The complete corrected file content as a string.
    """
    plans_json = json.dumps(plans, indent=2)

    user_content = (
        f"FILE: {file_path}\n\n"
        f"ORIGINAL CONTENT:\n{original_content}\n\n"
        f"APPROVED REMEDIATION PLANS:\n{plans_json}"
    )

    corrected = invoke(
        system_prompt=CODE_GENERATOR_SYSTEM_PROMPT,
        user_content=user_content,
        expect_json=False,
    )

    return corrected


def run_code_generator_streaming(file_path: str, original_content: str, plans: list[dict]):
    """
    Generator that yields SSE-compatible event dicts as it generates fixes.
    """
    from app.agents.gemini_client import invoke_streaming

    plans_json = json.dumps(plans, indent=2)
    user_content = (
        f"FILE: {file_path}\n\n"
        f"ORIGINAL CONTENT:\n{original_content}\n\n"
        f"APPROVED REMEDIATION PLANS:\n{plans_json}"
    )

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Code Generator", "chunk": f"Applying {len(plans)} remediation plan(s) to {file_path}...\n"}
    }

    full_response = ""
    for chunk in invoke_streaming(system_prompt=CODE_GENERATOR_SYSTEM_PROMPT, user_content=user_content):
        full_response += chunk

    yield {
        "event": "reasoning_chunk",
        "data": {"agent": "Code Generator", "chunk": f"Fixed {file_path}\n"}
    }

    yield {
        "event": "file_fixed",
        "data": {"agent": "Code Generator", "file": file_path, "fixed_content": full_response}
    }
