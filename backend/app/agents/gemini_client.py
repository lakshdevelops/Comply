import google.generativeai as genai
import json
from app.core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)


def invoke(system_prompt: str, user_content: str, expect_json: bool = True):
    """
    Call Gemini with a system prompt and user content.
    If expect_json=True, parse the response as JSON.
    Returns parsed JSON or raw text.
    """
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=system_prompt,
    )
    response = model.generate_content(user_content)
    text = response.text.strip()

    if expect_json:
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]).strip()
        return json.loads(text)
    return text
