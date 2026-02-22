export interface Consultancy {
  id: string;
  name: string;
  createdBy: string;
  plan: string;
  createdAt: string;
}

export type ComplianceFramework = "GDPR" | "DORA" | "ISO27001" | "SOC2" | "HIPAA" | "PCI-DSS";
export type CloudProvider = "AWS" | "Azure" | "GCP" | "Multi-Cloud";
export type InfrastructureType = "Terraform" | "Kubernetes" | "CloudFormation" | "Mixed";
export type Severity = "P0" | "P1" | "P2";
export type ScanStatus = "queued" | "running" | "completed" | "failed";

export interface Workspace {
  id: string;
  consultancy_id: string;
  client_name: string;
  client_industry: string;
  compliance_frameworks: ComplianceFramework[];
  cloud_provider: CloudProvider;
  infrastructure_type: InfrastructureType;
  status: string;
  created_by: string;
  created_at: string;
  githubUsername?: string;
}

export interface Repo {
  id: string;
  fullName: string;
  defaultBranch: string;
  connectedAt: string;
  isActive: boolean;
}

export interface WorkspaceScan {
  id: string;
  repoId: string;
  commitSha: string;
  status: ScanStatus;
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  summary?: {
    totalFindings: number;
    p0: number;
    p1: number;
    p2: number;
  };
}

export interface Finding {
  id: string;
  severity: Severity;
  ruleId: string;
  regulationRef: string;
  title: string;
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  evidence: string;
  confidence: number;
}

export interface FixPlan {
  id: string;
  findingId: string;
  planText: string;
  targetFiles: string[];
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

export interface WorkspaceDocument {
  id: string;
  name: string;
  storagePath: string;
  downloadURL: string;
  size: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: string;
}
