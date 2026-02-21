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
