const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function apiFetch(
  path: string,
  options: RequestInit = {},
  token: string
) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// GitHub
export const getGitHubStatus = (token: string) =>
  apiFetch("/github/status", {}, token);

export const getGitHubRepos = (token: string) =>
  apiFetch("/github/repos", {}, token);

export const getGitHubAuthorizeUrl = (token: string) =>
  `${API_BASE}/github/authorize?token=${encodeURIComponent(token)}`;

// Scans
export const triggerScan = (
  token: string,
  repoOwner: string,
  repoName: string
) =>
  apiFetch(
    "/scan",
    {
      method: "POST",
      body: JSON.stringify({ repo_owner: repoOwner, repo_name: repoName }),
    },
    token
  );

export const getScans = (token: string) => apiFetch("/scans", {}, token);

export const getScan = (token: string, scanId: string) =>
  apiFetch(`/scans/${scanId}`, {}, token);

export const deleteScan = (token: string, scanId: string) =>
  apiFetch(`/scans/${scanId}`, { method: "DELETE" }, token);

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
