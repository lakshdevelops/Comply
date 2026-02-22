from pydantic import BaseModel
from typing import List, Literal, Optional


# ── Plan feature matrix ─────────────────────────────────────────────
PLAN_FEATURES = {
    "free": {
        "continuous_scanning": False,
        "auto_pr": False,
        "legal_agent": False,
        "audit_logging": False,
        "sso": False,
        "max_repos": 1,
        "max_agent_runs": 50,
    },
    "starter": {
        "continuous_scanning": False,
        "auto_pr": False,
        "legal_agent": False,
        "audit_logging": False,
        "sso": False,
        "max_repos": 1,
        "max_agent_runs": 500,
    },
    "pro": {
        "continuous_scanning": True,
        "auto_pr": True,
        "legal_agent": False,
        "audit_logging": True,
        "sso": False,
        "max_repos": 10,
        "max_agent_runs": 5000,
    },
    "enterprise": {
        "continuous_scanning": True,
        "auto_pr": True,
        "legal_agent": True,
        "audit_logging": True,
        "sso": True,
        "max_repos": -1,          # unlimited
        "max_agent_runs": -1,     # unlimited
    },
}


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


# ── Billing / Pricing ───────────────────────────────────────────────

class CreateCheckoutRequest(BaseModel):
    plan: Literal["starter", "pro"]
    billing_interval: Literal["monthly", "annual"]


class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    current_period_end: Optional[str] = None
    billing_interval: Optional[str] = None
    features: dict


class UsageEvent(BaseModel):
    event_type: Literal["agent_run", "infra_scan", "pull_request", "legal_reasoning"]
    quantity: float = 1.0
    metadata: Optional[dict] = None


class UsageSummary(BaseModel):
    agent_runs: int = 0
    infra_scans: int = 0
    pull_requests: int = 0
    legal_tokens: float = 0.0
    period_start: str
    period_end: str


class EnterpriseContactRequest(BaseModel):
    name: str
    email: str
    company: str
    message: str = ""
