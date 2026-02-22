"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getScan, approveFixes, createPRs, createMiroDiagram } from "@/lib/api";
import ViolationCard from "../../components/ViolationCard";
import ScanProgress from "../../components/ScanProgress";
import PrStatus from "../../components/PrStatus";

interface Violation {
  id: string;
  severity: "critical" | "high" | "medium";
  description: string;
  file: string;
  line: number;
  resource: string;
  explanation: string;
  regulation_citation: string;
  what_needs_to_change: string;
  estimated_effort: string;
  priority: string;
  sample_fix: string;
  approved: boolean;
}

interface ScanData {
  id: string;
  repo_owner: string;
  repo_name: string;
  status: "scanning" | "completed" | "failed";
  created_at: string;
  violations: Violation[];
  reasoning_log: { agent: string; action: string; output: string; status: string }[];
  pr_urls?: string[];
}

export default function ScanResultPage() {
  const params = useParams();
  const scanId = params.id as string;
  const { getIdToken } = useAuth();

  const [scan, setScan] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [prLoading, setPrLoading] = useState(false);
  const [prUrls, setPrUrls] = useState<string[]>([]);
  const [prError, setPrError] = useState<string | null>(null);
  const [miroLoading, setMiroLoading] = useState(false);
  const [miroUrl, setMiroUrl] = useState<string | null>(null);
  const [miroError, setMiroError] = useState<string | null>(null);

  const fetchScan = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await getScan(token, scanId);
      setScan(data);
      // Initialize approved IDs from server state
      const approved = new Set<string>(
        (data.violations || [])
          .filter((v: Violation) => v.approved)
          .map((v: Violation) => v.id)
      );
      setApprovedIds(approved);
      if (data.pr_urls) setPrUrls(data.pr_urls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scan");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, scanId]);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  // Poll while scanning
  useEffect(() => {
    if (scan?.status !== "scanning") return;
    const interval = setInterval(fetchScan, 5000);
    return () => clearInterval(interval);
  }, [scan?.status, fetchScan]);

  const handleApprove = async (violationId: string) => {
    const token = await getIdToken();
    if (!token) return;

    const newApproved = new Set(approvedIds);
    if (newApproved.has(violationId)) {
      newApproved.delete(violationId);
    } else {
      newApproved.add(violationId);
    }
    setApprovedIds(newApproved);

    try {
      await approveFixes(token, scanId, Array.from(newApproved));
    } catch {
      // Revert on error
      setApprovedIds(approvedIds);
    }
  };

  const handleApproveAll = async () => {
    if (!scan) return;
    const token = await getIdToken();
    if (!token) return;

    const allIds = new Set(scan.violations.map((v) => v.id));
    setApprovedIds(allIds);

    try {
      await approveFixes(token, scanId, Array.from(allIds));
    } catch {
      setApprovedIds(approvedIds);
    }
  };

  const handleCreatePRs = async () => {
    const token = await getIdToken();
    if (!token) return;

    setPrLoading(true);
    setPrError(null);

    try {
      const result = await createPRs(token, scanId);
      setPrUrls(result.pr_urls || []);
    } catch (err) {
      setPrError(
        err instanceof Error ? err.message : "Failed to create pull requests"
      );
    } finally {
      setPrLoading(false);
    }
  };

  const handleExportMiro = async () => {
    const token = await getIdToken();
    if (!token) return;

    setMiroLoading(true);
    setMiroError(null);

    try {
      const result = await createMiroDiagram(token, scanId);
      // Miro MCP result may have a viewLink, url, or id
      const miroResult = result.miro_result || {};
      const link =
        miroResult.viewLink ||
        miroResult.url ||
        (miroResult.id
          ? `https://miro.com/app/board/${miroResult.id}/`
          : null);
      setMiroUrl(link || "Diagram created — check your Miro boards.");
    } catch (err) {
      setMiroError(
        err instanceof Error ? err.message : "Failed to export to Miro"
      );
    } finally {
      setMiroLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-warm-grey-400">
          Loading scan results...
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <XCircle className="h-8 w-8 text-red-400" />
        <p className="text-warm-grey-600">{error || "Scan not found"}</p>
        <Link
          href="/dashboard"
          className="text-sm text-warm-brown-600 hover:text-warm-brown-700"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const statusIcon =
    scan.status === "completed" ? (
      <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />
    ) : scan.status === "failed" ? (
      <XCircle className="h-5 w-5 text-red-500" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-yellow-500 animate-pulse" />
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-warm-grey-500 hover:text-warm-grey-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-warm-grey-900">
              {scan.repo_owner}/{scan.repo_name}
            </h1>
            <p className="mt-1 text-sm text-warm-grey-600">
              Scanned on{" "}
              {new Date(scan.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-sm font-medium capitalize text-warm-grey-800">
              {scan.status}
            </span>
          </div>
        </div>
      </div>

      {/* Progress timeline */}
      {scan.reasoning_log && scan.reasoning_log.length > 0 && (
        <ScanProgress steps={scan.reasoning_log} />
      )}

      {/* Violations */}
      {scan.violations && scan.violations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-warm-grey-900">
              Violations ({scan.violations.length})
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-warm-grey-500">
                {approvedIds.size} of {scan.violations.length} approved
              </span>
              <button
                onClick={handleApproveAll}
                className="rounded-xl bg-warm-brown-500 px-4 py-2 text-sm font-medium text-white hover:bg-warm-brown-600 transition-colors"
              >
                Approve All
              </button>
              <button
                onClick={handleCreatePRs}
                disabled={approvedIds.size === 0 || prLoading}
                className="rounded-xl bg-warm-brown-500 px-4 py-2 text-sm font-medium text-white hover:bg-warm-brown-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {prLoading ? "Creating PRs..." : "Create PRs"}
              </button>
              <button
                onClick={handleExportMiro}
                disabled={miroLoading}
                className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-medium text-yellow-950 hover:bg-yellow-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LayoutTemplate className="h-4 w-4" />
                {miroLoading ? "Exporting..." : "Export to Miro"}
              </button>
            </div>
          </div>

          {scan.violations.map((violation) => (
            <ViolationCard
              key={violation.id}
              violation={violation}
              isApproved={approvedIds.has(violation.id)}
              onApprove={() => handleApprove(violation.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {scan.status === "completed" &&
        (!scan.violations || scan.violations.length === 0) && (
          <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-warm-brown-500" />
            <h3 className="mt-3 font-display text-lg font-bold text-warm-grey-900">
              All Clear
            </h3>
            <p className="mt-1 text-sm text-warm-grey-600">
              No compliance violations were found in this repository.
            </p>
          </div>
        )}

      {/* PR Status */}
      {(prUrls.length > 0 || prLoading || prError) && (
        <PrStatus urls={prUrls} loading={prLoading} error={prError} />
      )}

      {/* Miro export result */}
      {(miroUrl || miroError) && (
        <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-warm-grey-900">
            <LayoutTemplate className="h-5 w-5 text-yellow-600" />
            Miro Diagram
          </h3>
          <div className="mt-3">
            {miroError && (
              <p className="text-sm text-red-500">{miroError}</p>
            )}
            {miroUrl && (
              miroUrl.startsWith("http") ? (
                <a
                  href={miroUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-yellow-700 underline hover:text-yellow-900"
                >
                  <LayoutTemplate className="h-4 w-4" />
                  Open in Miro
                </a>
              ) : (
                <p className="text-sm text-warm-grey-600">{miroUrl}</p>
              )
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
