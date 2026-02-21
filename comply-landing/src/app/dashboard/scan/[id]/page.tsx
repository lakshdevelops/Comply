"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Loader2,
  Bot,
  Scan,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getScan, getScanStreamUrl, approveFixes, createPRs } from "@/lib/api";
import ViolationCard from "../../components/ViolationCard";
import PrStatus from "../../components/PrStatus";

interface Violation {
  id: string;
  violation_id?: string;
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

interface AgentState {
  name: string;
  status: "pending" | "active" | "done";
  summary: string;
  reasoningChunks: string[];
}

type ScanStatus = "connecting" | "streaming" | "completed" | "failed";

export default function ScanResultPage() {
  const params = useParams();
  const scanId = params.id as string;
  const { getIdToken } = useAuth();

  const [scanStatus, setScanStatus] = useState<ScanStatus>("connecting");
  const [repoInfo, setRepoInfo] = useState({ owner: "", name: "", created_at: "" });
  const [agents, setAgents] = useState<AgentState[]>([
    { name: "Auditor", status: "pending", summary: "", reasoningChunks: [] },
    { name: "Strategist", status: "pending", summary: "", reasoningChunks: [] },
  ]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [plans, setPlans] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [prLoading, setPrLoading] = useState(false);
  const [prUrls, setPrUrls] = useState<string[]>([]);
  const [prError, setPrError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reasoningEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning into view
  useEffect(() => {
    if (scanStatus === "streaming") {
      reasoningEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [agents, scanStatus]);

  const updateAgent = useCallback((name: string, updater: (prev: AgentState) => AgentState) => {
    setAgents((prev) =>
      prev.map((a) => (a.name === name ? updater(a) : a))
    );
  }, []);

  // Load completed scan or start SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let cancelled = false;

    async function init() {
      const token = await getIdToken();
      if (!token || cancelled) return;

      // Check if scan already completed
      try {
        const data = await getScan(token, scanId);
        setRepoInfo({
          owner: data.repo_owner,
          name: data.repo_name,
          created_at: data.created_at,
        });

        if (data.status === "completed" || data.status === "failed") {
          setScanStatus(data.status);

          // Populate agents from reasoning log
          const log = data.reasoning_log || [];
          setAgents((prev) =>
            prev.map((a) => {
              const entry = log.find((l: { agent: string }) => l.agent === a.name);
              return entry
                ? { ...a, status: "done" as const, summary: entry.output }
                : a;
            })
          );

          // Populate violations with plan data merged
          const planMap = new Map<string, Record<string, unknown>>();
          for (const p of data.remediation_plans || []) {
            planMap.set(p.violation_id, p);
          }
          setPlans(planMap);

          const viols = (data.violations || []).map((v: Record<string, unknown>) => {
            const plan = planMap.get((v.id || v.violation_id) as string) || {};
            return { ...v, ...plan };
          });
          setViolations(viols as Violation[]);

          const approved = new Set<string>(
            viols.filter((v: Record<string, unknown>) => v.approved).map((v: Record<string, unknown>) => (v.id || v.violation_id) as string)
          );
          setApprovedIds(approved);
          if (data.pr_urls) setPrUrls(data.pr_urls);
          return;
        }
      } catch {
        // Scan might be pending (just created), proceed to SSE
      }

      // Open SSE connection
      setScanStatus("streaming");
      const url = getScanStreamUrl(token, scanId);
      eventSource = new EventSource(url);

      eventSource.addEventListener("agent_start", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        updateAgent(data.agent, (a) => ({
          ...a,
          status: "active",
          reasoningChunks: [...a.reasoningChunks, data.message + "\n"],
        }));
        setExpandedAgent(data.agent);
      });

      eventSource.addEventListener("reasoning_chunk", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        updateAgent(data.agent, (a) => ({
          ...a,
          reasoningChunks: [...a.reasoningChunks, data.chunk],
        }));
      });

      eventSource.addEventListener("violation_found", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const v = data.violation;
        setViolations((prev) => [...prev, { ...v, id: v.violation_id || v.id }]);
      });

      eventSource.addEventListener("plan_ready", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const plan = data.plan;
        setPlans((prev) => {
          const next = new Map(prev);
          next.set(plan.violation_id, plan);
          return next;
        });
        // Merge plan data into matching violation
        setViolations((prev) =>
          prev.map((v) =>
            (v.id === plan.violation_id || v.violation_id === plan.violation_id)
              ? { ...v, ...plan, id: v.id }
              : v
          )
        );
      });

      eventSource.addEventListener("agent_complete", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        updateAgent(data.agent, (a) => ({
          ...a,
          status: "done",
          summary: data.summary,
        }));
      });

      eventSource.addEventListener("scan_complete", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        void data;
        // Fetch full scan data for repo info
        getScan(token, scanId).then((full) => {
          setRepoInfo({
            owner: full.repo_owner,
            name: full.repo_name,
            created_at: full.created_at,
          });
        }).catch(() => {});
        setScanStatus("completed");
        eventSource?.close();
      });

      eventSource.addEventListener("scan_error", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setError(data.message);
        setScanStatus("failed");
        eventSource?.close();
      });

      eventSource.onerror = () => {
        setScanStatus((prev) => {
          if (prev !== "completed") {
            setError("Connection lost. Refresh to check scan status.");
            return "failed";
          }
          return prev;
        });
        eventSource?.close();
      };
    }

    init();

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  // Fetch repo info for streaming scans
  useEffect(() => {
    if (repoInfo.owner) return;
    async function fetchInfo() {
      const token = await getIdToken();
      if (!token) return;
      try {
        const data = await getScan(token, scanId);
        setRepoInfo({
          owner: data.repo_owner,
          name: data.repo_name,
          created_at: data.created_at,
        });
      } catch { /* ignore */ }
    }
    fetchInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId, repoInfo.owner]);

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
      setApprovedIds(approvedIds);
    }
  };

  const handleApproveAll = async () => {
    const token = await getIdToken();
    if (!token) return;
    const allIds = new Set(violations.map((v) => v.id));
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
      setPrError(err instanceof Error ? err.message : "Failed to create pull requests");
    } finally {
      setPrLoading(false);
    }
  };

  const isStreaming = scanStatus === "streaming" || scanStatus === "connecting";

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
              {repoInfo.owner && repoInfo.name
                ? `${repoInfo.owner}/${repoInfo.name}`
                : "Loading..."}
            </h1>
            {repoInfo.created_at && (
              <p className="mt-1 text-sm text-warm-grey-600">
                Scanned on{" "}
                {new Date(repoInfo.created_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {scanStatus === "completed" && <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />}
            {scanStatus === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
            {isStreaming && <Loader2 className="h-5 w-5 text-warm-brown-500 animate-spin" />}
            <span className="text-sm font-medium capitalize text-warm-grey-800">
              {scanStatus === "connecting" ? "Starting..." : scanStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Reasoning Trace */}
      <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
        <h3 className="font-display text-lg font-bold text-warm-grey-900">
          Reasoning Trace
        </h3>
        <p className="mt-1 text-sm text-warm-grey-600">
          Live chain-of-thought from compliance agents.
        </p>

        <div className="mt-5 space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="rounded-xl border border-warm-grey-200 bg-white overflow-hidden"
            >
              {/* Agent header - always visible */}
              <button
                onClick={() =>
                  setExpandedAgent(expandedAgent === agent.name ? null : agent.name)
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-warm-grey-50 transition-colors"
              >
                <div className="flex-shrink-0">
                  {agent.status === "active" && (
                    <Loader2 className="h-5 w-5 text-warm-brown-500 animate-spin" />
                  )}
                  {agent.status === "done" && (
                    <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />
                  )}
                  {agent.status === "pending" && (
                    <Bot className="h-5 w-5 text-warm-grey-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-warm-grey-900">
                    {agent.name}
                  </span>
                  {agent.summary && (
                    <span className="ml-2 text-xs text-warm-grey-500">
                      &mdash; {agent.summary}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-warm-grey-400 transition-transform ${
                    expandedAgent === agent.name ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded reasoning */}
              <AnimatePresence>
                {expandedAgent === agent.name && agent.reasoningChunks.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-warm-grey-200 bg-warm-grey-900 px-4 py-3 max-h-80 overflow-y-auto">
                      <pre className="text-xs text-warm-grey-100 font-mono whitespace-pre-wrap leading-relaxed">
                        {agent.reasoningChunks.join("")}
                        {agent.status === "active" && (
                          <span className="inline-block w-2 h-4 bg-warm-brown-400 animate-pulse ml-0.5 align-middle" />
                        )}
                      </pre>
                      <div ref={expandedAgent === agent.name ? reasoningEndRef : undefined} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-warm-grey-900">
              Violations ({violations.length})
            </h2>
            {scanStatus === "completed" && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-warm-grey-500">
                  {approvedIds.size} of {violations.length} approved
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
              </div>
            )}
          </div>

          <AnimatePresence>
            {violations.map((violation) => (
              <motion.div
                key={violation.id || violation.violation_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ViolationCard
                  violation={violation}
                  isApproved={approvedIds.has(violation.id)}
                  onApprove={() => handleApprove(violation.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Streaming empty state */}
      {isStreaming && violations.length === 0 && (
        <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-12 text-center">
          <Scan className="mx-auto h-8 w-8 text-warm-brown-400 animate-pulse" />
          <p className="mt-3 text-sm text-warm-grey-500">
            Scanning for compliance violations...
          </p>
        </div>
      )}

      {/* Completed empty state */}
      {scanStatus === "completed" && violations.length === 0 && (
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

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* PR Status */}
      {(prUrls.length > 0 || prLoading || prError) && (
        <PrStatus urls={prUrls} loading={prLoading} error={prError} />
      )}
    </motion.div>
  );
}
