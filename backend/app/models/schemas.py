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


class ChatRequest(BaseModel):
    scan_id: str
    question: str


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


# ── Comp.ly Integration: Enums ────────────────────────────────────

from enum import Enum

class ComplianceFramework(str, Enum):
    GDPR = "GDPR"
    DORA = "DORA"
    ISO27001 = "ISO27001"
    SOC2 = "SOC2"
    HIPAA = "HIPAA"
    PCI_DSS = "PCI-DSS"

class CloudProvider(str, Enum):
    AWS = "AWS"
    AZURE = "Azure"
    GCP = "GCP"
    MULTI_CLOUD = "Multi-Cloud"

class InfrastructureType(str, Enum):
    TERRAFORM = "Terraform"
    KUBERNETES = "Kubernetes"
    CLOUDFORMATION = "CloudFormation"
    MIXED = "Mixed"

class Severity(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"


# ── Comp.ly Integration: Consultancy ──────────────────────────────

class CreateConsultancyRequest(BaseModel):
    name: str

class ConsultancyResponse(BaseModel):
    id: str
    name: str
    created_by: str
    plan: str
    created_at: str


# ── Comp.ly Integration: Workspace ────────────────────────────────

class CreateWorkspaceRequest(BaseModel):
    client_name: str
    client_industry: str
    compliance_frameworks: List[ComplianceFramework]
    cloud_provider: CloudProvider
    infrastructure_type: InfrastructureType

class WorkspaceResponse(BaseModel):
    id: str
    consultancy_id: str
    client_name: str
    client_industry: str
    compliance_frameworks: List[str]
    cloud_provider: str
    infrastructure_type: str
    status: str
    created_by: str
    created_at: str


# ── Comp.ly Integration: GitHub (workspace-scoped) ────────────────

class GitHubConnectRequest(BaseModel):
    code: str
    redirect_uri: str

class ConnectRepoRequest(BaseModel):
    full_name: str
    default_branch: str = "main"


# ── Comp.ly Integration: Scan (workspace-scoped) ─────────────────

class TriggerScanRequest(BaseModel):
    repo_id: str

class ScanSummary(BaseModel):
    total_findings: int = 0
    p0: int = 0
    p1: int = 0
    p2: int = 0

class WorkspaceScanResponse(BaseModel):
    id: str
    repo_id: str
    commit_sha: str
    status: str
    triggered_by: str
    started_at: str
    completed_at: Optional[str] = None
    summary: Optional[ScanSummary] = None


# ── Comp.ly Integration: Findings & Plans ─────────────────────────

class FindingSchema(BaseModel):
    severity: Severity
    rule_id: str
    regulation_ref: str
    title: str
    description: str
    file_path: str
    line_start: int
    line_end: int
    evidence: str
    confidence: float

class ApprovePlanResponse(BaseModel):
    plan_id: str
    approved: bool
    approved_by: str


# ── Comp.ly Integration: Document ─────────────────────────────────

class DocumentMetadata(BaseModel):
    id: str
    name: str
    storage_path: str
    download_url: str
    size: int
    content_type: str
    uploaded_by: str
    uploaded_at: str
