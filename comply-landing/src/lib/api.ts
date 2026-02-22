import { auth } from "./firebase";
import type {
  Consultancy,
  Workspace,
  WorkspaceScan,
  Finding,
  FixPlan,
  WorkspaceDocument,
} from "@/types/comply";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Consultancies
export async function createConsultancy(name: string): Promise<Consultancy> {
  return apiFetch("/consultancies", { method: "POST", body: JSON.stringify({ name }) });
}

export async function getConsultancy(id: string): Promise<Consultancy> {
  return apiFetch(`/consultancies/${id}`);
}

// Workspaces
export async function listWorkspaces(): Promise<Workspace[]> {
  return apiFetch("/workspaces");
}

export async function createWorkspace(data: {
  client_name: string;
  client_industry: string;
  compliance_frameworks: string[];
  cloud_provider: string;
  infrastructure_type: string;
}): Promise<Workspace> {
  return apiFetch("/workspaces", { method: "POST", body: JSON.stringify(data) });
}

export async function getWorkspace(id: string): Promise<Workspace> {
  return apiFetch(`/workspaces/${id}`);
}

export const getScans = (token: string) => apiFetch("/scans", {}, token);

export const getScan = (token: string, scanId: string) =>
  apiFetch(`/scans/${scanId}`, {}, token);

export const deleteScan = (token: string, scanId: string) =>
  apiFetch(`/scans/${scanId}`, { method: "DELETE" }, token);

export const getScanStreamUrl = (token: string, scanId: string) =>
  `${API_BASE}/scan/${scanId}/stream?token=${encodeURIComponent(token)}`;

// Fixes
export const approveFixes = (
  token: string,
  scanId: string,
  violationIds: string[]
) =>
  apiFetch(
    "/fixes/approve",
    {
      method: "POST",
      body: JSON.stringify({ scan_id: scanId, violation_ids: violationIds }),
    },
    token
  );

export const createPRs = (token: string, scanId: string) =>
  apiFetch(
    "/fixes/create-prs",
    { method: "POST", body: JSON.stringify({ scan_id: scanId }) },
    token
  );

export const getPRStreamUrl = (token: string, scanId: string) =>
  `${API_BASE}/fixes/create-prs/stream?scan_id=${encodeURIComponent(scanId)}&token=${encodeURIComponent(token)}`;

// Legal
export const explainRegulation = (token: string, regulationRef: string) =>
  apiFetch(
    "/legal/explain",
    {
      method: "POST",
      body: JSON.stringify({ regulation_ref: regulationRef }),
    },
    token
  );

// Chat
export const getChatHistory = (token: string, scanId: string) =>
  apiFetch(`/chat/${scanId}`, {}, token);

export const getChatStreamUrl = (
  token: string,
  scanId: string,
  question: string
) =>
  `${API_BASE}/chat/${scanId}/stream?token=${encodeURIComponent(token)}&question=${encodeURIComponent(question)}`;

// Billing
export const getSubscription = (token: string) =>
  apiFetch("/billing/subscription", {}, token);

export const createSubscription = (
  token: string,
  plan: string,
  billingInterval: string
) =>
  apiFetch(
    "/billing/create-subscription",
    {
      method: "POST",
      body: JSON.stringify({ plan, billing_interval: billingInterval }),
    },
    token
  );

export const cancelSubscription = (token: string) =>
  apiFetch("/billing/cancel", { method: "POST" }, token);

export const confirmSubscription = (token: string) =>
  apiFetch("/billing/confirm-subscription", { method: "POST" }, token);

export const getUsageSummary = (token: string) =>
  apiFetch("/billing/usage", {}, token);

export const submitEnterpriseContact = (
  name: string,
  email: string,
  company: string,
  message: string
) =>
  fetch(`${API_BASE}/billing/enterprise-contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, company, message }),
  }).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

// Workspace GitHub
export async function connectWorkspaceGitHub(
  workspaceId: string, code: string, redirectUri: string
): Promise<{ connected: boolean; githubUsername: string }> {
  return apiFetch(`/workspaces/${workspaceId}/github/connect`, {
    method: "POST", body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
}

export async function listWorkspaceGitHubRepos(
  workspaceId: string
): Promise<{ repos: { full_name: string; default_branch: string }[] }> {
  return apiFetch(`/workspaces/${workspaceId}/github/repos`);
}

export async function connectWorkspaceRepo(
  workspaceId: string, fullName: string, defaultBranch: string = "main"
): Promise<{ id: string }> {
  return apiFetch(`/workspaces/${workspaceId}/repos`, {
    method: "POST", body: JSON.stringify({ full_name: fullName, default_branch: defaultBranch }),
  });
}

// Workspace Scans
export async function triggerWorkspaceScan(
  workspaceId: string, repoId: string
): Promise<{ scanId: string; status: string }> {
  return apiFetch(`/workspaces/${workspaceId}/scans`, {
    method: "POST", body: JSON.stringify({ repo_id: repoId }),
  });
}

export async function getWorkspaceScan(
  workspaceId: string, scanId: string
): Promise<WorkspaceScan> {
  return apiFetch(`/workspaces/${workspaceId}/scans/${scanId}`);
}

export async function listScanFindings(
  workspaceId: string, scanId: string
): Promise<Finding[]> {
  return apiFetch(`/workspaces/${workspaceId}/scans/${scanId}/findings`);
}

export async function listScanPlans(
  workspaceId: string, scanId: string
): Promise<FixPlan[]> {
  return apiFetch(`/workspaces/${workspaceId}/scans/${scanId}/plans`);
}

export async function approvePlan(
  workspaceId: string, scanId: string, planId: string
): Promise<{ planId: string; approved: boolean }> {
  return apiFetch(`/workspaces/${workspaceId}/scans/${scanId}/plans/${planId}/approve`, { method: "POST" });
}

// Documents
export async function listDocuments(workspaceId: string): Promise<WorkspaceDocument[]> {
  return apiFetch(`/workspaces/${workspaceId}/documents`);
}

export async function deleteDocument(workspaceId: string, documentId: string): Promise<void> {
  return apiFetch(`/workspaces/${workspaceId}/documents/${documentId}`, { method: "DELETE" });
}

// ── Legacy API functions (used by existing scan/dashboard pages) ──────────

async function legacyApiFetch(path: string, options: RequestInit = {}, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// GitHub (legacy)
export const getGitHubStatus = (token: string) =>
  legacyApiFetch("/github/status", {}, token);

export const getGitHubRepos = (token: string) =>
  legacyApiFetch("/github/repos", {}, token);

export const getGitHubAuthorizeUrl = (token: string) =>
  `${API_BASE}/github/authorize?token=${encodeURIComponent(token)}`;

export const disconnectGitHub = (token: string) =>
  legacyApiFetch("/github/disconnect", { method: "DELETE" }, token);

// Scans (legacy)
export const triggerScan = (token: string, repoOwner: string, repoName: string) =>
  legacyApiFetch(
    "/scan",
    { method: "POST", body: JSON.stringify({ repo_owner: repoOwner, repo_name: repoName }) },
    token
  );

export const getScans = (token: string) => legacyApiFetch("/scans", {}, token);

export const getScan = (token: string, scanId: string) =>
  legacyApiFetch(`/scans/${scanId}`, {}, token);

export const deleteScan = (token: string, scanId: string) =>
  legacyApiFetch(`/scans/${scanId}`, { method: "DELETE" }, token);

export const getScanStreamUrl = (token: string, scanId: string) =>
  `${API_BASE}/scan/${scanId}/stream?token=${encodeURIComponent(token)}`;

// Fixes (legacy)
export const approveFixes = (token: string, scanId: string, violationIds: string[]) =>
  legacyApiFetch(
    "/fixes/approve",
    { method: "POST", body: JSON.stringify({ scan_id: scanId, violation_ids: violationIds }) },
    token
  );

export const createPRs = (token: string, scanId: string) =>
  legacyApiFetch(
    "/fixes/create-prs",
    { method: "POST", body: JSON.stringify({ scan_id: scanId }) },
    token
  );

export const getPRStreamUrl = (token: string, scanId: string) =>
  `${API_BASE}/fixes/create-prs/stream?scan_id=${encodeURIComponent(scanId)}&token=${encodeURIComponent(token)}`;

// Legal (legacy)
export const explainRegulation = (token: string, regulationRef: string) =>
  legacyApiFetch(
    "/legal/explain",
    { method: "POST", body: JSON.stringify({ regulation_ref: regulationRef }) },
    token
  );

// Chat (legacy)
export const getChatHistory = (token: string, scanId: string) =>
  legacyApiFetch(`/chat/${scanId}`, {}, token);

export const getChatStreamUrl = (token: string, scanId: string, question: string) =>
  `${API_BASE}/chat/${scanId}/stream?token=${encodeURIComponent(token)}&question=${encodeURIComponent(question)}`;

// Billing (legacy)
export const getSubscription = (token: string) =>
  legacyApiFetch("/billing/subscription", {}, token);

export const createSubscription = (token: string, plan: string, billingInterval: string) =>
  legacyApiFetch(
    "/billing/create-subscription",
    { method: "POST", body: JSON.stringify({ plan, billing_interval: billingInterval }) },
    token
  );

export const cancelSubscription = (token: string) =>
  legacyApiFetch("/billing/cancel", { method: "POST" }, token);

export const getUsageSummary = (token: string) =>
  legacyApiFetch("/billing/usage", {}, token);

export const submitEnterpriseContact = (name: string, email: string, company: string, message: string) =>
  fetch(`${API_BASE}/billing/enterprise-contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, company, message }),
  }).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

export const getStripeConfig = () =>
  fetch(`${API_BASE}/billing/config`).then((r) => {
    if (!r.ok) throw new Error("Failed to load Stripe config");
    return r.json();
  });

// Miro (legacy)
export const getMiroStatus = (token: string) =>
  legacyApiFetch("/miro/status", {}, token);

export const getMiroAuthorizeUrl = (token: string) =>
  `${API_BASE}/miro/authorize?token=${encodeURIComponent(token)}`;

export const createMiroDiagram = (token: string, scanId: string) =>
  legacyApiFetch(
    "/miro/diagram",
    { method: "POST", body: JSON.stringify({ scan_id: scanId }) },
    token
  );
