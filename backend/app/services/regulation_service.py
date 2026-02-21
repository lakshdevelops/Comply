import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

_rules = None
_regulatory_texts = None


def get_rules() -> list:
    """Load and return all compliance rules from rules.json."""
    global _rules
    if _rules is None:
        with open(os.path.join(DATA_DIR, "rules.json")) as f:
            _rules = json.load(f)
    return _rules


def get_regulatory_texts() -> dict:
    """Load and return all regulatory texts from regulatory_texts.json."""
    global _regulatory_texts
    if _regulatory_texts is None:
        with open(os.path.join(DATA_DIR, "regulatory_texts.json")) as f:
            _regulatory_texts = json.load(f)
    return _regulatory_texts


def get_article_context(regulation_ref: str) -> dict:
    """Look up regulatory text by reference.

    For example, 'DORA-Art9-3b' resolves to key 'DORA-Art9' in regulatory_texts.json.

    Args:
        regulation_ref: A reference string such as 'DORA-Art9-3b', 'GDPR-Art32-1a', or 'CIS-2.1-1'.

    Returns:
        The regulatory text dict for the matching article, or an empty dict if not found.
    """
    texts = get_regulatory_texts()
    parts = regulation_ref.split("-")
    if len(parts) >= 2:
        article_key = f"{parts[0]}-{parts[1]}"
    else:
        article_key = regulation_ref
    return texts.get(article_key, {})
