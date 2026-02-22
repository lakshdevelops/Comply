# Comply Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous regulatory compliance platform that scans GitHub repos for infrastructure violations, produces remediation plans, and ships fixes as PRs.

**Architecture:** FastAPI backend with LangGraph pipelines orchestrating Gemini SDK agents (Auditor, Strategist, Code Generator, Legal Advisor). Next.js frontend with Firebase auth for login and a separate GitHub OAuth flow for repo access. SQLite for scan state persistence. Static JSON files for regulatory data.

**Tech Stack:** Python 3 / FastAPI / LangGraph / Gemini SDK / SQLite / PyGithub / Next.js 16 / React 19 / Tailwind CSS 4 / Firebase Auth

---

## Codebase Context

- Frontend lives at `comply-landing/` (root level)
- Backend lives at `backend/`
- Auth is Firebase (Google OAuth) — NOT NextAuth
- Firebase config: `comply-landing/src/lib/firebase.ts`
- Auth context: `comply-landing/src/contexts/AuthContext.tsx`
- Backend Firebase verification: `backend/app/core/security.py`
- Existing backend router: `backend/app/api/router.py` includes `v1/auth.py`
- Color palette: hunter-green, fern, pine-teal, dry-sage, dust-grey (see `globals.css`)
- Font: Playfair Display (display), Geist (sans), Geist Mono (mono)

---

## Task 1: Backend Dependencies & Config

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/core/config.py`
- Create: `backend/.env.example`

**Step 1: Update requirements.txt**

Add these to the existing requirements.txt:

```
google-generativeai>=0.8.0
langgraph>=0.2.0
langchain-core>=0.3.0
PyGithub>=2.3.0
aiosqlite>=0.20.0
python-dotenv>=1.0.0
```

**Step 2: Install dependencies**

```bash
cd backend && pip install -r requirements.txt
```

**Step 3: Create config.py**

```python
# backend/app/core/config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/v1/github/callback")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./comply.db")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

settings = Settings()
```

**Step 4: Create .env.example**

```
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/v1/github/callback
DATABASE_URL=sqlite:///./comply.db
FRONTEND_URL=http://localhost:3000
```

**Step 5: Commit**

```bash
git add backend/requirements.txt backend/app/core/config.py backend/.env.example
git commit -m "feat: add backend dependencies and config"
```

---

## Task 2: SQLite Database Setup

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models/db_models.py`

**Step 1: Create database.py**

SQLite setup using aiosqlite with a simple sync wrapper for initial use. Tables:
- `scans`: id, user_id, repo_url, repo_owner, repo_name, status (pending/scanning/completed/failed), created_at, updated_at
- `violations`: id, scan_id, rule_id, severity, file, line, resource, field, current_value, description, regulation_ref
- `remediation_plans`: id, scan_id, violation_id, explanation, regulation_citation, what_needs_to_change, sample_fix, estimated_effort, priority, file, approved (boolean)
- `approved_fixes`: id, scan_id, violation_id, production_code, file, original_content, fixed_content
- `qa_results`: id, scan_id, iteration, is_clean, new_violations_json
- `pull_requests`: id, scan_id, pr_url, file, violation_count, branch_name
- `reasoning_log`: id, scan_id, agent, action, output, created_at
- `github_tokens`: id, user_id (Firebase UID), access_token, github_username, created_at

Use raw SQL with sqlite3 (synchronous, simpler for hackathon). Create tables on app startup.

```python
# backend/app/database.py
import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "comply.db")

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            repo_url TEXT NOT NULL,
            repo_owner TEXT NOT NULL,
            repo_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS violations (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            rule_id TEXT NOT NULL,
            severity TEXT NOT NULL,
            file TEXT NOT NULL,
            line INTEGER,
            resource TEXT,
            field TEXT,
            current_value TEXT,
            description TEXT NOT NULL,
            regulation_ref TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS remediation_plans (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            violation_id TEXT NOT NULL REFERENCES violations(id),
            explanation TEXT NOT NULL,
            regulation_citation TEXT NOT NULL,
            what_needs_to_change TEXT NOT NULL,
            sample_fix TEXT,
            estimated_effort TEXT,
            priority TEXT NOT NULL,
            file TEXT NOT NULL,
            approved INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS approved_fixes (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            violation_id TEXT NOT NULL REFERENCES violations(id),
            production_code TEXT,
            file TEXT NOT NULL,
            original_content TEXT,
            fixed_content TEXT
        );
        CREATE TABLE IF NOT EXISTS qa_results (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            iteration INTEGER NOT NULL,
            is_clean INTEGER NOT NULL,
            new_violations_json TEXT
        );
        CREATE TABLE IF NOT EXISTS pull_requests (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            pr_url TEXT NOT NULL,
            file TEXT NOT NULL,
            violation_count INTEGER NOT NULL,
            branch_name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reasoning_log (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            agent TEXT NOT NULL,
            action TEXT NOT NULL,
            output TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS github_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE,
            access_token TEXT NOT NULL,
            github_username TEXT,
            created_at TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()
```

**Step 2: Wire init_db into FastAPI startup**

In `backend/app/main.py`, add:
```python
from app.database import init_db

@app.on_event("startup")
def startup():
    init_db()
```

**Step 3: Test the DB initializes**

```bash
cd backend && python -c "from app.database import init_db; init_db(); print('OK')"
```

**Step 4: Commit**

```bash
git add backend/app/database.py backend/app/main.py
git commit -m "feat: add SQLite database with schema"
```

---

## Task 3: Pydantic Schemas

**Files:**
- Create: `backend/app/models/schemas.py`

Define Pydantic models matching the spec's TypedDicts. These are used for API request/response validation and for passing data between pipeline nodes.

```python
# backend/app/models/schemas.py
from pydantic import BaseModel
from typing import List, Optional

class Violation(BaseModel):
    violation_id: str
    rule_id: str
    severity: str           # "critical" | "high" | "medium"
    file: str
    line: Optional[int] = None
    resource: Optional[str] = None
    field: Optional[str] = None
    current_value: Optional[str] = None
    description: str
    regulation_ref: str

class RemediationPlan(BaseModel):
    violation_id: str
    explanation: str
    regulation_citation: str
    what_needs_to_change: str
    sample_fix: Optional[str] = None
    estimated_effort: Optional[str] = None
    priority: str           # "P0" | "P1" | "P2"
    file: str

class ApprovedFix(BaseModel):
    violation_id: str
    file: str
    original_content: str
    fixed_content: str

class QAResult(BaseModel):
    new_violations: List[Violation]
    is_clean: bool

class ScanRequest(BaseModel):
    repo_owner: str
    repo_name: str

class ApproveRequest(BaseModel):
    scan_id: str
    violation_ids: List[str]

class CreatePRsRequest(BaseModel):
    scan_id: str

class LegalExplainRequest(BaseModel):
    regulation_ref: str

class ScanResponse(BaseModel):
    scan_id: str
    status: str
    violations: List[Violation] = []
    remediation_plans: List[RemediationPlan] = []
    reasoning_log: List[dict] = []

class PRResponse(BaseModel):
    scan_id: str
    pull_requests: List[dict] = []
    reasoning_log: List[dict] = []
```

**Step 1: Create the file with the models above**

**Step 2: Verify it imports**

```bash
cd backend && python -c "from app.models.schemas import Violation, ScanRequest; print('OK')"
```

**Step 3: Commit**

```bash
git add backend/app/models/schemas.py
git commit -m "feat: add Pydantic schemas for compliance state"
```

---

## Task 4: Regulatory Data Files

**Files:**
- Create: `backend/data/rules.json`
- Create: `backend/data/regulatory_texts.json`
- Create: `backend/app/services/regulation_service.py`

**Step 1: Create rules.json**

Pre-built ruleset with DORA and GDPR rules targeting common Terraform/K8s violations. Include 10-15 rules covering:
- DORA Art 9(3)(b): Encryption at rest for databases
- DORA Art 9(3)(c): Encryption in transit
- DORA Art 9(4)(c): Cryptographic key management / rotation
- DORA Art 10: Logging and monitoring
- DORA Art 11(1): Backup and recovery
- DORA Art 12: Incident detection / alerting
- GDPR Art 32(1)(a): Encryption of personal data
- GDPR Art 32(1)(b): Confidentiality / access controls
- GDPR Art 32(1)(c): Availability / multi-AZ
- CIS AWS 2.1.1: S3 bucket encryption
- CIS AWS 2.1.2: S3 bucket public access block

Each rule has: rule_id, regulation, article, title, description, severity, and resource_checks array with provider, resource_type, field, violation_condition, fix_template.

**Step 2: Create regulatory_texts.json**

Key-value store of full regulation text, keyed by article reference (e.g. "DORA-Art9"). Include full_text and sub_clauses for each article referenced in rules.json.

**Step 3: Create regulation_service.py**

```python
# backend/app/services/regulation_service.py
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

_rules = None
_regulatory_texts = None

def get_rules() -> list:
    global _rules
    if _rules is None:
        with open(os.path.join(DATA_DIR, "rules.json")) as f:
            _rules = json.load(f)
    return _rules

def get_regulatory_texts() -> dict:
    global _regulatory_texts
    if _regulatory_texts is None:
        with open(os.path.join(DATA_DIR, "regulatory_texts.json")) as f:
            _regulatory_texts = json.load(f)
    return _regulatory_texts

def get_article_context(regulation_ref: str) -> dict:
    """Look up regulatory text by reference. e.g. 'DORA-Art9-3b' → look up 'DORA-Art9'."""
    texts = get_regulatory_texts()
    # Strip the sub-clause suffix to get the article key
    parts = regulation_ref.split("-")
    if len(parts) >= 2:
        article_key = f"{parts[0]}-{parts[1]}"
    else:
        article_key = regulation_ref
    return texts.get(article_key, {})
```

**Step 4: Verify**

```bash
cd backend && python -c "from app.services.regulation_service import get_rules; print(f'{len(get_rules())} rules loaded')"
```

**Step 5: Commit**

```bash
git add backend/data/ backend/app/services/regulation_service.py
git commit -m "feat: add regulatory ruleset and text store"
```

---

## Task 5: Gemini SDK Client

**Files:**
- Create: `backend/app/agents/gemini_client.py`

Single wrapper around the Gemini Python SDK. All agents call through this.

```python
# backend/app/agents/gemini_client.py
import google.generativeai as genai
import json
from app.core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

def invoke(system_prompt: str, user_content: str, expect_json: bool = True) -> any:
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
            # Remove first line (```json) and last line (```)
            text = "\n".join(lines[1:-1]).strip()
        return json.loads(text)
    return text
```

**Step 1: Create the file**

**Step 2: Test with a simple prompt (requires GEMINI_API_KEY in .env)**

```bash
cd backend && python -c "
from app.agents.gemini_client import invoke
result = invoke('You are a test assistant. Respond with JSON.', 'Return {\"status\": \"ok\"}', expect_json=True)
print(result)
"
```

**Step 3: Commit**

```bash
git add backend/app/agents/gemini_client.py
git commit -m "feat: add Gemini SDK client wrapper"
```

---

## Task 6: Auditor Agent

**Files:**
- Create: `backend/app/agents/auditor.py`

The Auditor receives repo files + ruleset and returns structured violations.

```python
# backend/app/agents/auditor.py
import json
import uuid
from app.agents.gemini_client import invoke
from app.services.regulation_service import get_rules

AUDITOR_SYSTEM_PROMPT = """
You are the Auditor Agent of Comply.
ROLE: Scan infrastructure files for regulatory violations.
MODE: Read-only. Detect and report only. Do NOT suggest fixes.

RULESET:
{ruleset}

For each violation found, output a JSON object with these exact fields:
- violation_id: a unique string (use format "v-" + 3 random chars)
- rule_id: the rule_id from the ruleset that is violated
- severity: "critical", "high", or "medium"
- file: the filename where the violation occurs
- line: approximate line number (integer or null)
- resource: the resource name/identifier
- field: the specific field that violates the rule
- current_value: what the field is currently set to (or "missing" if absent)
- description: one-sentence description of the violation
- regulation_ref: the regulation reference key (e.g. "DORA-Art9-3b")

Output ONLY a valid JSON array of violation objects. If no violations found, output [].
"""

def run_auditor(repo_files: dict[str, str], is_qa_rescan: bool = False) -> list[dict]:
    """
    Scan repo files against the regulatory ruleset.
    If is_qa_rescan=True, only scan for NEW violations introduced by fixes.
    """
    ruleset = get_rules()
    system_prompt = AUDITOR_SYSTEM_PROMPT.format(ruleset=json.dumps(ruleset, indent=2))

    if is_qa_rescan:
        system_prompt += "\n\nThis is a QA RE-SCAN. Only report NEW violations that were not in the original scan. If the files are clean, return []."

    # Build file content string
    file_content = ""
    for filename, content in repo_files.items():
        file_content += f"\n--- FILE: {filename} ---\n{content}\n"

    violations = invoke(system_prompt, file_content, expect_json=True)

    # Ensure each violation has a unique ID
    for v in violations:
        if not v.get("violation_id"):
            v["violation_id"] = f"v-{uuid.uuid4().hex[:8]}"

    return violations
```

**Step 1: Create the file**

**Step 2: Commit**

```bash
git add backend/app/agents/auditor.py
git commit -m "feat: add Auditor agent"
```

---

## Task 7: Strategist Agent

**Files:**
- Create: `backend/app/agents/strategist.py`

Takes violations, enriches with regulatory context via KV lookup, produces remediation plans.

```python
# backend/app/agents/strategist.py
import json
from app.agents.gemini_client import invoke
from app.services.regulation_service import get_article_context

STRATEGIST_SYSTEM_PROMPT = """
You are the Strategist Agent of Comply.

For each violation, produce a REMEDIATION PLAN containing:
1. violation_id — must match the input violation's violation_id exactly
2. explanation — plain-language summary for a non-technical compliance officer
3. regulation_citation — the specific regulatory text being violated
4. what_needs_to_change — plain language description of the fix
5. sample_fix — an illustrative code snippet showing the general shape of the fix
6. estimated_effort — story points or hours (e.g. "2 story points", "1 hour")
7. priority — "P0" (critical), "P1" (high), or "P2" (medium)
8. file — the file path from the violation

Output ONLY a valid JSON array of remediation plan objects.
"""

def run_strategist(violations: list[dict]) -> list[dict]:
    """Enrich violations with regulatory context and produce remediation plans."""
    enriched = []
    for v in violations:
        reg_context = get_article_context(v.get("regulation_ref", ""))
        enriched.append({
            **v,
            "regulatory_text": reg_context.get("full_text", ""),
            "specific_clause": reg_context.get("sub_clauses", {}),
        })

    user_content = f"VIOLATIONS WITH REGULATORY CONTEXT:\n{json.dumps(enriched, indent=2)}"
    plans = invoke(STRATEGIST_SYSTEM_PROMPT, user_content, expect_json=True)
    return plans
```

**Step 1: Create the file**

**Step 2: Commit**

```bash
git add backend/app/agents/strategist.py
git commit -m "feat: add Strategist agent"
```

---

## Task 8: Code Generator Agent

**Files:**
- Create: `backend/app/agents/code_generator.py`

Takes approved remediation plans + original file content. Produces production-ready fixed files.

```python
# backend/app/agents/code_generator.py
import json
from app.agents.gemini_client import invoke

CODE_GEN_SYSTEM_PROMPT = """
You are the Code Generator Agent of Comply.

Generate a PRODUCTION-READY corrected version of the file below.
Apply ALL of the following approved remediation plans.

The code must be:
- Valid and deployable
- Address every approved violation
- Preserve all existing functionality that is not related to violations
- Use best practices for the infrastructure tool (Terraform, Kubernetes, etc.)

Output the COMPLETE corrected file content. Nothing else — no explanations, no markdown fences, just the raw file content.
"""

def run_code_generator(file_path: str, original_content: str, plans: list[dict]) -> str:
    """Generate production-ready fix for a file given its remediation plans."""
    user_content = f"""PLANS:
{json.dumps(plans, indent=2)}

ORIGINAL FILE ({file_path}):
{original_content}"""

    fixed_content = invoke(CODE_GEN_SYSTEM_PROMPT, user_content, expect_json=False)
    return fixed_content
```

**Step 1: Create the file**

**Step 2: Commit**

```bash
git add backend/app/agents/code_generator.py
git commit -m "feat: add Code Generator agent"
```

---

## Task 9: Legal Advisor Agent

**Files:**
- Create: `backend/app/agents/legal_advisor.py`

On-demand. Explains regulations in plain language.

```python
# backend/app/agents/legal_advisor.py
from app.agents.gemini_client import invoke
from app.services.regulation_service import get_article_context

LEGAL_ADVISOR_SYSTEM_PROMPT = """
You are the Legal Advisor Agent of Comply.

Explain this regulation in plain language for a non-technical compliance officer.
No jargon. Focus on:
- What this regulation requires in practical terms
- What happens if the company doesn't comply (penalties, consequences)
- Why this regulation exists (the intent behind it)

Do NOT suggest fixes or remediation steps. That is the Strategist's job.
Keep your explanation under 300 words.
"""

def run_legal_advisor(regulation_ref: str) -> str:
    """Explain a regulation in plain language."""
    reg_context = get_article_context(regulation_ref)
    full_text = reg_context.get("full_text", "Regulation text not found.")
    title = reg_context.get("title", "")

    user_content = f"REGULATION: {title}\n\n{full_text}"
    explanation = invoke(LEGAL_ADVISOR_SYSTEM_PROMPT, user_content, expect_json=False)
    return explanation
```

**Step 1: Create the file**

**Step 2: Commit**

```bash
git add backend/app/agents/legal_advisor.py
git commit -m "feat: add Legal Advisor agent"
```

---

## Task 10: GitHub Service

**Files:**
- Create: `backend/app/services/github_service.py`

Handles: GitHub OAuth token exchange, listing user repos, reading repo files (filtered for infra), creating branches/commits/PRs.

Key functions:
- `exchange_code_for_token(code: str) -> dict` — OAuth code→token exchange via HTTP POST to GitHub
- `get_user_repos(access_token: str) -> list` — List repos the user has access to
- `get_repo_infra_files(access_token: str, owner: str, repo: str) -> dict[str, str]` — Fetch tree, filter for .tf/.yaml/.yml/Dockerfile/docker-compose*, read contents. Returns {path: content}.
- `create_pr(access_token: str, owner: str, repo: str, file_fixes: list, plans: list) -> dict` — Create branch, commit fixed files, open PR with structured description.

Use PyGithub for all GitHub API interactions. For OAuth token exchange, use `requests` since PyGithub doesn't handle OAuth.

The infra file filter should match: `*.tf`, `*.yaml`, `*.yml`, `Dockerfile`, `docker-compose*.yml`, `*.json` (only if in paths containing "terraform", "k8s", "kubernetes", "infrastructure", "infra", or at repo root).

**Step 1: Create the file with all functions above**

**Step 2: Commit**

```bash
git add backend/app/services/github_service.py
git commit -m "feat: add GitHub service for repo access and PR creation"
```

---

## Task 11: LangGraph Scan Pipeline

**Files:**
- Create: `backend/app/graphs/scan_pipeline.py`

LangGraph StateGraph: Auditor → Strategist → END.

State is a TypedDict with: repo_files, violations, remediation_plans, reasoning_log.

```python
# backend/app/graphs/scan_pipeline.py
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from app.agents.auditor import run_auditor
from app.agents.strategist import run_strategist

class ScanState(TypedDict):
    repo_files: dict          # {filename: content}
    violations: list
    remediation_plans: list
    reasoning_log: list

def auditor_node(state: ScanState) -> dict:
    violations = run_auditor(state["repo_files"])
    return {
        "violations": violations,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "Auditor",
            "action": "scan",
            "output": f"{len(violations)} violations detected"
        }]
    }

def strategist_node(state: ScanState) -> dict:
    plans = run_strategist(state["violations"])
    return {
        "remediation_plans": plans,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "Strategist",
            "action": "plan",
            "output": f"{len(plans)} remediation plans produced"
        }]
    }

def build_scan_graph():
    graph = StateGraph(ScanState)
    graph.add_node("auditor", auditor_node)
    graph.add_node("strategist", strategist_node)
    graph.set_entry_point("auditor")
    graph.add_edge("auditor", "strategist")
    graph.add_edge("strategist", END)
    return graph.compile()

scan_app = build_scan_graph()
```

**Step 1: Create the file**

**Step 2: Commit**

```bash
git add backend/app/graphs/scan_pipeline.py
git commit -m "feat: add LangGraph scan pipeline (Auditor → Strategist)"
```

---

## Task 12: LangGraph PR Pipeline

**Files:**
- Create: `backend/app/graphs/pr_pipeline.py`

LangGraph StateGraph: Code Generator → QA Re-scan → conditional loop (max 3) → PR creation.

QA re-scan reuses the Auditor with `is_qa_rescan=True`.

```python
# backend/app/graphs/pr_pipeline.py
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from app.agents.auditor import run_auditor
from app.agents.code_generator import run_code_generator

class PRState(TypedDict):
    repo_files: dict              # {filename: content}
    approved_plans: list          # RemediationPlan dicts, grouped by file
    fixes: list                   # {file, original_content, fixed_content, plans}
    qa_iterations: int
    qa_clean: bool
    reasoning_log: list

def code_gen_node(state: PRState) -> dict:
    plans_by_file = {}
    for plan in state["approved_plans"]:
        plans_by_file.setdefault(plan["file"], []).append(plan)

    fixes = []
    for file_path, plans in plans_by_file.items():
        original = state["repo_files"].get(file_path, "")
        fixed = run_code_generator(file_path, original, plans)
        fixes.append({
            "file": file_path,
            "original_content": original,
            "fixed_content": fixed,
            "plans": plans,
        })

    return {
        "fixes": fixes,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "Code Generator",
            "action": "generate",
            "output": f"{len(fixes)} files modified"
        }]
    }

def qa_rescan_node(state: PRState) -> dict:
    modified_files = {**state["repo_files"]}
    for fix in state["fixes"]:
        modified_files[fix["file"]] = fix["fixed_content"]

    new_violations = run_auditor(modified_files, is_qa_rescan=True)
    iteration = state["qa_iterations"] + 1
    is_clean = len(new_violations) == 0

    return {
        "qa_iterations": iteration,
        "qa_clean": is_clean,
        "reasoning_log": state["reasoning_log"] + [{
            "agent": "QA Re-scan",
            "action": f"iteration {iteration}",
            "output": "CLEAN" if is_clean else f"{len(new_violations)} new violations"
        }]
    }

def qa_router(state: PRState) -> str:
    if state["qa_clean"]:
        return "done"
    elif state["qa_iterations"] >= 3:
        return "done"
    else:
        return "retry"

def build_pr_graph():
    graph = StateGraph(PRState)
    graph.add_node("code_gen", code_gen_node)
    graph.add_node("qa_rescan", qa_rescan_node)
    graph.set_entry_point("code_gen")
    graph.add_edge("code_gen", "qa_rescan")
    graph.add_conditional_edges("qa_rescan", qa_router, {
        "retry": "code_gen",
        "done": END,
    })
    return graph.compile()

pr_app = build_pr_graph()
```

**Step 1: Create the file**

**Step 2: Commit**

```bash
git add backend/app/graphs/pr_pipeline.py
git commit -m "feat: add LangGraph PR pipeline with QA loop"
```

---

## Task 13: API Routes — Scan

**Files:**
- Create: `backend/app/routes/scan.py`
- Modify: `backend/app/api/router.py`

Endpoints:
- `POST /api/v1/scan` — Trigger a scan (requires Firebase auth + GitHub token). Reads repo files via GitHub API, runs scan pipeline, saves results to SQLite.
- `GET /api/v1/scans` — List all scans for the authenticated user.
- `GET /api/v1/scans/{scan_id}` — Get scan details with violations, plans, reasoning log.

The scan endpoint should:
1. Verify Firebase auth (get user_id from token)
2. Look up GitHub access_token from github_tokens table
3. Fetch repo infra files via GitHub API
4. Create scan record in DB (status: scanning)
5. Run scan_app pipeline
6. Save violations + remediation_plans + reasoning_log to DB
7. Update scan status to completed
8. Return scan results

**Step 1: Create scan.py with all three endpoints**

**Step 2: Add scan router to api/router.py**

```python
# Add to backend/app/api/router.py
from app.routes import scan
router.include_router(scan.router, prefix="/scan", tags=["scan"])
```

**Step 3: Commit**

```bash
git add backend/app/routes/scan.py backend/app/api/router.py
git commit -m "feat: add scan API routes"
```

---

## Task 14: API Routes — Fixes & PRs

**Files:**
- Create: `backend/app/routes/fixes.py`
- Modify: `backend/app/api/router.py`

Endpoints:
- `POST /api/v1/fixes/approve` — Mark violation_ids as approved. Updates remediation_plans.approved=1 in DB.
- `POST /api/v1/fixes/create-prs` — Run PR pipeline for all approved fixes in a scan. Runs code_gen → QA loop → creates PRs via GitHub API. Saves results to DB.
- `GET /api/v1/fixes/{scan_id}/status` — Get PR creation status and PR URLs.

**Step 1: Create fixes.py**

**Step 2: Add to router.py**

**Step 3: Commit**

```bash
git add backend/app/routes/fixes.py backend/app/api/router.py
git commit -m "feat: add fix approval and PR creation routes"
```

---

## Task 15: API Routes — Legal Advisor

**Files:**
- Create: `backend/app/routes/legal.py`
- Modify: `backend/app/api/router.py`

Endpoints:
- `POST /api/v1/legal/explain` — Takes regulation_ref, returns plain language explanation.

**Step 1: Create legal.py**

**Step 2: Add to router.py**

**Step 3: Commit**

```bash
git add backend/app/routes/legal.py backend/app/api/router.py
git commit -m "feat: add Legal Advisor API route"
```

---

## Task 16: API Routes — GitHub OAuth

**Files:**
- Create: `backend/app/routes/github.py`
- Modify: `backend/app/api/router.py`

Endpoints:
- `GET /api/v1/github/authorize` — Redirects to GitHub OAuth authorization URL with `repo` + `read:user` scopes. State parameter includes Firebase UID.
- `GET /api/v1/github/callback` — Receives code from GitHub, exchanges for access token, stores in github_tokens table, redirects to frontend dashboard.
- `GET /api/v1/github/repos` — List repos for the connected GitHub account.
- `GET /api/v1/github/status` — Check if user has connected GitHub.

Note: The authorize endpoint needs the Firebase user ID. The frontend will call this endpoint and include the Firebase ID token in the request. The backend verifies the token, extracts the UID, and includes it in the OAuth state parameter.

**Step 1: Create github.py**

**Step 2: Add to router.py**

**Step 3: Commit**

```bash
git add backend/app/routes/github.py backend/app/api/router.py
git commit -m "feat: add GitHub OAuth routes for repo access"
```

---

## Task 17: Update FastAPI Main

**Files:**
- Modify: `backend/app/main.py`

Ensure all routes are included, CORS allows the frontend origin, and startup initializes the DB. Also add a `/health` endpoint.

**Step 1: Update main.py to include all new route modules and startup**

**Step 2: Test server starts**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: wire up all routes and startup in FastAPI"
```

---

## Task 18: Sample Infrastructure Files

**Files:**
- Create: `demo/sample-infra/terraform/main.tf`
- Create: `demo/sample-infra/terraform/variables.tf`
- Create: `demo/sample-infra/k8s/deployment.yaml`
- Create: `demo/sample-infra/k8s/service.yaml`

Create intentionally non-compliant infrastructure files that will trigger violations from our ruleset:

**Terraform (main.tf):**
- `aws_db_instance` with `storage_encrypted = false` (DORA Art 9(3)(b))
- `aws_s3_bucket` without encryption configuration (CIS AWS 2.1.1)
- `aws_s3_bucket` without public access block (CIS AWS 2.1.2)
- `aws_instance` without monitoring enabled (DORA Art 10)
- No backup/recovery configuration (DORA Art 11)
- No CloudWatch/logging configuration (DORA Art 12)
- Security group with overly permissive ingress (GDPR Art 32(1)(b))

**Kubernetes (deployment.yaml):**
- Container running as root (GDPR Art 32(1)(b))
- No resource limits (availability concern — GDPR Art 32(1)(c))
- No liveness/readiness probes
- Using `latest` tag instead of pinned version

**Step 1: Create all demo files with intentional violations**

**Step 2: Commit**

```bash
git add demo/
git commit -m "feat: add sample infra files with intentional violations"
```

---

## Task 19: Frontend — Dashboard Layout

**Files:**
- Create: `comply-landing/src/app/dashboard/layout.tsx`

Dashboard layout with:
- Top nav bar (Comply logo, user avatar from Firebase, sign out button)
- Sidebar or top tabs for navigation (optional for v1 — keep simple)
- Main content area

Reuse the existing color palette and fonts. Use the same component patterns (rounded cards, subtle borders, backdrop blur).

**Step 1: Create dashboard layout**

**Step 2: Commit**

```bash
git add comply-landing/src/app/dashboard/
git commit -m "feat: add dashboard layout"
```

---

## Task 20: Frontend — Dashboard Main Page

**Files:**
- Create: `comply-landing/src/app/dashboard/page.tsx`
- Create: `comply-landing/src/app/dashboard/components/RepoConnect.tsx`
- Create: `comply-landing/src/app/dashboard/components/ScanHistory.tsx`

The main dashboard page shows:
1. **GitHub connection status** — If not connected, show "Connect GitHub" button that redirects to backend OAuth endpoint. If connected, show green status with GitHub username.
2. **Repository selector** — Dropdown of user's repos (fetched from backend `/api/v1/github/repos`). "Scan" button.
3. **Scan history** — List of past scans with status, repo name, violation count, date. Click to view details.

The RepoConnect component:
- Check `/api/v1/github/status` on mount
- If not connected: show "Connect GitHub" button → redirects to `/api/v1/github/authorize` with Firebase token
- If connected: show repo dropdown + scan button

The ScanHistory component:
- Fetch `/api/v1/scans` on mount
- Display as a list of cards with scan info
- Click navigates to `/dashboard/scan/[id]`

**Step 1: Create all three files**

**Step 2: Verify page renders at localhost:3000/dashboard**

**Step 3: Commit**

```bash
git add comply-landing/src/app/dashboard/
git commit -m "feat: add dashboard main page with repo connect and scan history"
```

---

## Task 21: Frontend — Scan Results Page

**Files:**
- Create: `comply-landing/src/app/dashboard/scan/[id]/page.tsx`
- Create: `comply-landing/src/app/dashboard/components/ViolationCard.tsx`
- Create: `comply-landing/src/app/dashboard/components/ScanProgress.tsx`
- Create: `comply-landing/src/app/dashboard/components/PrStatus.tsx`

The scan results page shows:
1. **Scan progress** (ScanProgress) — chain-of-thought timeline showing which agents ran and what they found. Uses reasoning_log from the scan.
2. **Violations list** — Each violation rendered as a ViolationCard.
3. **Bulk actions** — "Approve All" button, "Create PRs" button (only if any approved).

**ViolationCard** matches the spec mockup:
```
🔴 CRITICAL — Database encryption disabled
File: terraform/main.tf (line 14)
Resource: aws_db_instance.customer_data

WHAT'S WRONG:
[explanation from remediation plan]

REGULATION:
[regulation_citation]

PROPOSED CHANGE:
[what_needs_to_change]

EFFORT: 2 story points | PRIORITY: P0

[Explain Regulation]  [View Sample Fix]  [✓ Approve Fix]
```

- Severity badge colors: critical=red, high=orange, medium=yellow
- "Explain Regulation" button → calls `/api/v1/legal/explain`, shows response in a modal/drawer
- "View Sample Fix" → expandable section showing the sample_fix code
- "Approve Fix" → toggle button, calls `/api/v1/fixes/approve`
- Approved cards get a green check border

**PrStatus** — shown after "Create PRs" is clicked:
- Shows progress (generating code... QA re-scan... creating PR...)
- Shows PR URLs when done, linked to GitHub

**Step 1: Create the scan results page**

**Step 2: Create ViolationCard component**

**Step 3: Create ScanProgress component**

**Step 4: Create PrStatus component**

**Step 5: Commit**

```bash
git add comply-landing/src/app/dashboard/
git commit -m "feat: add scan results page with violation cards and PR status"
```

---

## Task 22: Frontend — API Client

**Files:**
- Create: `comply-landing/src/lib/api.ts`

Centralized API client that:
- Uses the Firebase ID token for auth (via `getIdToken()` from AuthContext)
- Points to `http://localhost:8000/api/v1` (configurable via env var)
- Has typed functions for each API call:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function apiFetch(path: string, options: RequestInit = {}, token: string) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

// GitHub
export const getGitHubStatus = (token: string) => apiFetch("/github/status", {}, token);
export const getGitHubRepos = (token: string) => apiFetch("/github/repos", {}, token);

// Scans
export const triggerScan = (token: string, repoOwner: string, repoName: string) =>
    apiFetch("/scan", { method: "POST", body: JSON.stringify({ repo_owner: repoOwner, repo_name: repoName }) }, token);
export const getScans = (token: string) => apiFetch("/scans", {}, token);
export const getScan = (token: string, scanId: string) => apiFetch(`/scans/${scanId}`, {}, token);

// Fixes
export const approveFixes = (token: string, scanId: string, violationIds: string[]) =>
    apiFetch("/fixes/approve", { method: "POST", body: JSON.stringify({ scan_id: scanId, violation_ids: violationIds }) }, token);
export const createPRs = (token: string, scanId: string) =>
    apiFetch("/fixes/create-prs", { method: "POST", body: JSON.stringify({ scan_id: scanId }) }, token);

// Legal
export const explainRegulation = (token: string, regulationRef: string) =>
    apiFetch("/legal/explain", { method: "POST", body: JSON.stringify({ regulation_ref: regulationRef }) }, token);
```

**Step 1: Create the file**

**Step 2: Commit**

```bash
git add comply-landing/src/lib/api.ts
git commit -m "feat: add typed API client for backend"
```

---

## Task 23: Frontend — Auth Guard

**Files:**
- Create: `comply-landing/src/components/auth/AuthGuard.tsx`

A wrapper component that redirects to /auth/login if the user is not authenticated. Used by the dashboard layout.

```typescript
"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) router.push("/auth/login");
    }, [user, loading, router]);

    if (loading) return <LoadingSkeleton />;
    if (!user) return null;
    return <>{children}</>;
}
```

**Step 1: Create the file**

**Step 2: Wire into dashboard layout.tsx**

**Step 3: Commit**

```bash
git add comply-landing/src/components/auth/AuthGuard.tsx comply-landing/src/app/dashboard/layout.tsx
git commit -m "feat: add auth guard for dashboard"
```

---

## Task 24: Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `comply-landing/Dockerfile`

**docker-compose.yml:**
- `backend` service: Python, port 8000, mounts .env
- `frontend` service: Node, port 3000, depends_on backend

**backend/Dockerfile:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**comply-landing/Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

**Step 1: Create all three files**

**Step 2: Test with docker compose up**

**Step 3: Commit**

```bash
git add docker-compose.yml backend/Dockerfile comply-landing/Dockerfile
git commit -m "feat: add Docker Compose for single-command setup"
```

---

## Task 25: Integration Test — Full Scan Flow

**Test manually:**

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd comply-landing && npm run dev`
3. Open `http://localhost:3000`, sign in with Google
4. Click "Connect GitHub" on dashboard
5. Authorize the GitHub OAuth app
6. Select a repo (or the demo sample-infra if pushed to a test repo)
7. Click "Scan" — verify chain-of-thought progress shows
8. Verify violations appear with remediation plans
9. Click "Explain Regulation" on a violation — verify legal explanation appears
10. Click "Approve Fix" on critical violations
11. Click "Create PRs" — verify PR pipeline runs
12. Verify PRs appear on GitHub

**Step 1: Run through the flow, fix any issues**

**Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes"
```

---

## Execution Order & Dependencies

```
Task 1 (deps/config)
  └── Task 2 (database)
      └── Task 3 (schemas)
          ├── Task 4 (regulatory data)
          ├── Task 5 (Gemini client)
          │   ├── Task 6 (Auditor)
          │   ├── Task 7 (Strategist)
          │   ├── Task 8 (Code Generator)
          │   └── Task 9 (Legal Advisor)
          ├── Task 10 (GitHub service)
          └── Tasks 11-12 (LangGraph pipelines, need agents)
              └── Tasks 13-16 (API routes, need pipelines + services)
                  └── Task 17 (wire up main.py)

Task 18 (demo files) — independent, can be done anytime

Tasks 19-23 (frontend) — need API routes to be done
  └── Task 22 (API client) should be done before Tasks 20-21

Task 24 (Docker) — after everything works

Task 25 (integration test) — last
```
