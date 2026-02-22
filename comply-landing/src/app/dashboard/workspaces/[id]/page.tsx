"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Shield, Cloud, GitBranch, FileText, Play, Upload, ChevronRight } from "lucide-react";
import { getWorkspace, triggerWorkspaceScan } from "@/lib/api";
import { listWorkspaceRepos, listWorkspaceDocuments } from "@/lib/firestore";
import { uploadWorkspaceDocument } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import type { Workspace, WorkspaceDocument } from "@/types/comply";

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [tab, setTab] = useState<"overview" | "repos" | "documents">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [ws, repoList, docList] = await Promise.all([
        getWorkspace(id),
        listWorkspaceRepos(id),
        listWorkspaceDocuments(id),
      ]);
      setWorkspace(ws);
      setRepos(repoList);
      setDocuments(docList as WorkspaceDocument[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      await uploadWorkspaceDocument(id, file, user.uid, setUploadProgress);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleScan = async (repoId: string) => {
    try {
      const result = await triggerWorkspaceScan(id, repoId);
      window.location.href = `/dashboard/workspaces/${id}/scans/${result.scanId}`;
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="animate-pulse h-64 rounded-2xl bg-warm-grey-100" />;
  if (!workspace) return <div className="text-red-600">{error || "Workspace not found"}</div>;

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "repos" as const, label: "Repositories" },
    { key: "documents" as const, label: "Documents" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      <div>
        <Link href="/dashboard/workspaces" className="text-sm text-warm-grey-500 hover:text-warm-grey-700 mb-2 inline-block">Workspaces</Link>
        <ChevronRight className="inline h-3 w-3 mx-1 text-warm-grey-400" />
        <span className="text-sm text-warm-grey-700">{workspace.client_name}</span>
        <h1 className="mt-2 font-display text-2xl font-bold text-warm-grey-900">{workspace.client_name}</h1>
        <p className="mt-1 text-sm text-warm-grey-500">{workspace.client_industry}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {workspace.compliance_frameworks.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 rounded-full bg-warm-brown-100 px-2.5 py-1 text-xs font-medium text-warm-brown-700">
            <Shield className="h-3 w-3" />{f}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full bg-warm-grey-100 px-2.5 py-1 text-xs font-medium text-warm-grey-600">
          <Cloud className="h-3 w-3" />{workspace.cloud_provider}
        </span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-1 border-b border-warm-grey-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? "border-b-2 border-warm-brown-500 text-warm-brown-600" : "text-warm-grey-500 hover:text-warm-grey-700"
            }`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-5">
            <p className="text-xs text-warm-grey-500 uppercase tracking-wider">Repositories</p>
            <p className="mt-1 text-2xl font-bold text-warm-grey-900">{repos.length}</p>
          </div>
          <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-5">
            <p className="text-xs text-warm-grey-500 uppercase tracking-wider">Documents</p>
            <p className="mt-1 text-2xl font-bold text-warm-grey-900">{documents.length}</p>
          </div>
          <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-5">
            <p className="text-xs text-warm-grey-500 uppercase tracking-wider">Status</p>
            <p className="mt-1 text-2xl font-bold text-green-600 capitalize">{workspace.status}</p>
          </div>
        </div>
      )}

      {tab === "repos" && (
        <div className="space-y-4">
          {repos.length === 0 ? (
            <p className="text-sm text-warm-grey-500">No repositories connected yet.</p>
          ) : repos.map((repo: any) => (
            <div key={repo.id} className="flex items-center justify-between rounded-xl border border-warm-grey-200 bg-warm-grey-50 p-4">
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5 text-warm-grey-400" />
                <div>
                  <p className="text-sm font-medium text-warm-grey-900">{repo.fullName}</p>
                  <p className="text-xs text-warm-grey-500">{repo.defaultBranch}</p>
                </div>
              </div>
              <button onClick={() => handleScan(repo.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-warm-brown-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-warm-brown-600 transition-colors"
              ><Play className="h-3 w-3" /> Scan</button>
            </div>
          ))}
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-warm-grey-300 p-8 hover:border-warm-brown-400 transition-colors">
            <Upload className="h-5 w-5 text-warm-grey-400" />
            <span className="text-sm text-warm-grey-600">
              {uploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Drop a file or click to upload"}
            </span>
            <input type="file" className="hidden" onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.xlsx,.csv,.txt,.json,.yaml,.yml" disabled={uploading}
            />
          </label>
          {documents.length === 0 ? (
            <p className="text-sm text-warm-grey-500">No documents uploaded yet.</p>
          ) : documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-xl border border-warm-grey-200 bg-warm-grey-50 p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-warm-grey-400" />
                <div>
                  <a href={doc.downloadURL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-warm-brown-600 hover:underline">{doc.name}</a>
                  <p className="text-xs text-warm-grey-500">{(doc.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
