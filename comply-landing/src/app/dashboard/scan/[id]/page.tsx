"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Scan,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  getScan,
  getScanStreamUrl,
  approveFixes,
  getPRStreamUrl,
  getChatHistory,
  getChatStreamUrl,
} from "@/lib/api";
import ReactMarkdown from "react-markdown";
import AgentReasoningCard from "../../components/AgentReasoningCard";
import ViolationsWidget from "../../components/ViolationsWidget";
import ViolationGroup from "../../components/ViolationGroup";
import PRStatusCard from "../../components/PRStatusCard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

type TimelineMessage =
  | {
      type: "agent";
      id: string;
      agent: string;
      status: "active" | "done";
      reasoningChunks: string[];
      summary: string;
    }
  | { type: "violations" }
  | { type: "user"; content: string }
  | { type: "assistant"; id: string; content: string }
  | {
      type: "pr_status";
      prUrl: string;
      branch: string;
      violationCount: number;
      qaIterations: number;
    }
  | { type: "pr_loading" }
  | { type: "qa_violations"; violations: Violation[]; iteration: number };

type ScanStatus = "connecting" | "streaming" | "completed" | "failed";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ScanResultPage() {
  const params = useParams();
  const scanId = params.id as string;
  const { getIdToken } = useAuth();
  const { hasFeature } = usePlan();

  /* --- core state ------------------------------------------------- */
  const [scanStatus, setScanStatus] = useState<ScanStatus>("connecting");
  const [repoInfo, setRepoInfo] = useState({ owner: "", name: "", created_at: "" });
  const [violations, setViolations] = useState<Violation[]>([]);
  const [plans, setPlans] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* --- timeline state --------------------------------------------- */
  const [messages, setMessages] = useState<TimelineMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);

  /* --- auto-scroll timeline --------------------------------------- */
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [messages]);

  /* ---------------------------------------------------------------- */
  /*  Load completed scan OR start SSE stream                         */
  /* ---------------------------------------------------------------- */

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

          // Build timeline from DB data
          const timeline: TimelineMessage[] = [];

          // 1. Agent reasoning cards from reasoning_log
          const log = data.reasoning_log || [];
          const auditorEntry = log.find((l: { agent: string }) => l.agent === "Auditor");
          if (auditorEntry) {
            timeline.push({
              type: "agent",
              id: "auditor",
              agent: "Auditor",
              status: "done",
              summary: auditorEntry.output,
              reasoningChunks: auditorEntry.full_text ? [auditorEntry.full_text] : [],
            });
          }
          const strategistEntry = log.find((l: { agent: string }) => l.agent === "Strategist");
          if (strategistEntry) {
            timeline.push({
              type: "agent",
              id: "strategist",
              agent: "Strategist",
              status: "done",
              summary: strategistEntry.output,
              reasoningChunks: strategistEntry.full_text ? [strategistEntry.full_text] : [],
            });
          }

          // 2. Violations widget (populate violations state and add widget marker)
          const planMap = new Map<string, Record<string, unknown>>();
          for (const p of data.remediation_plans || []) {
            planMap.set(p.violation_id, p);
          }
          setPlans(planMap);

          const viols = (data.violations || []).map((v: Record<string, unknown>) => {
            const plan = planMap.get((v.id || v.violation_id) as string) || {};
            return { ...v, ...plan, id: v.id as string };
          });
          setViolations(viols as Violation[]);

          const approved = new Set<string>(
            viols
              .filter((v: Record<string, unknown>) => v.approved)
              .map((v: Record<string, unknown>) => (v.id || v.violation_id) as string)
          );
          setApprovedIds(approved);

          if (viols.length > 0) {
            timeline.push({ type: "violations" });
          }

          // 3. Chat messages from chat history
          try {
            const chatData = await getChatHistory(token, scanId);
            for (const msg of chatData.messages || []) {
              if (msg.role === "user") {
                timeline.push({ type: "user", content: msg.content });
              } else {
                timeline.push({ type: "assistant", id: msg.id, content: msg.content });
              }
            }
          } catch {
            /* no chat history */
          }

          // 4. PR pipeline agent cards + PR status
          const prAgents = log.filter((l: { agent: string }) =>
            ["Code Generator", "QA Re-scan", "Strategist (Replan)"].includes(l.agent)
          );
          for (const entry of prAgents) {
            timeline.push({
              type: "agent",
              id: `pr-${entry.agent}`,
              agent: entry.agent,
              status: "done",
              summary: entry.output,
              reasoningChunks: entry.full_text ? [entry.full_text] : [],
            });
          }

          if (data.pr_urls && data.pr_urls.length > 0) {
            timeline.push({
              type: "pr_status",
              prUrl: data.pr_urls[0],
              branch: "comply-fix",
              violationCount: viols.length,
              qaIterations: 1,
            });
          }

          setMessages(timeline);
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
        setMessages((prev) => [
          ...prev,
          {
            type: "agent",
            id: `agent-${Date.now()}`,
            agent: data.agent,
            status: "active",
            reasoningChunks: [data.message + "\n"],
            summary: "",
          },
        ]);
      });

      eventSource.addEventListener("reasoning_chunk", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            const msg = updated[i];
            if (msg.type === "agent" && msg.agent === data.agent) {
              updated[i] = {
                ...msg,
                reasoningChunks: [...msg.reasoningChunks, data.chunk],
              };
              break;
            }
          }
          return updated;
        });
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
            v.id === plan.violation_id || v.violation_id === plan.violation_id
              ? { ...v, ...plan, id: v.id }
              : v
          )
        );
      });

      eventSource.addEventListener("agent_complete", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            const msg = updated[i];
            if (msg.type === "agent" && msg.agent === data.agent) {
              updated[i] = { ...msg, status: "done", summary: data.summary };
              break;
            }
          }
          return updated;
        });
      });

      eventSource.addEventListener("scan_complete", () => {
        // Fetch full scan data — critical to replace streamed violation IDs with DB IDs
        getScan(token, scanId)
          .then((full) => {
            setRepoInfo({
              owner: full.repo_owner,
              name: full.repo_name,
              created_at: full.created_at,
            });
            // Replace violations with DB versions (DB uses UUIDs, streamed used auditor IDs)
            const planMap = new Map<string, Record<string, unknown>>();
            for (const p of full.remediation_plans || []) {
              planMap.set(p.violation_id, p);
            }
            setPlans(planMap);
            const dbViols = (full.violations || []).map((v: Record<string, unknown>) => {
              const plan = planMap.get(v.id as string) || {};
              return { ...v, ...plan, id: v.id as string };
            });
            setViolations(dbViols as Violation[]);
          })
          .catch(() => {});
        setScanStatus("completed");
        setMessages((prev) => [...prev, { type: "violations" }]);
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
      } catch {
        /* ignore */
      }
    }
    fetchInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId, repoInfo.owner]);

  /* ---------------------------------------------------------------- */
  /*  Approve / Create PRs                                            */
  /* ---------------------------------------------------------------- */

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
    const allApproved = approvedIds.size === violations.length;
    const newIds = allApproved ? new Set<string>() : new Set(violations.map((v) => v.id));
    setApprovedIds(newIds);
    try {
      await approveFixes(token, scanId, Array.from(newIds));
    } catch {
      setApprovedIds(approvedIds);
    }
  };

  const handleCreatePRs = async () => {
    const token = await getIdToken();
    if (!token) return;
    setPrLoading(true);
    setPrError(null);

    // Add loading message
    setMessages((prev) => [...prev, { type: "pr_loading" }]);

    const url = getPRStreamUrl(token, scanId);
    const prEventSource = new EventSource(url);

    prEventSource.addEventListener("agent_start", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => {
        // Remove pr_loading if it exists
        const filtered = prev.filter((m) => m.type !== "pr_loading");
        return [
          ...filtered,
          {
            type: "agent",
            id: `pr-agent-${Date.now()}`,
            agent: data.agent,
            status: "active",
            reasoningChunks: [data.message + "\n"],
            summary: "",
          },
        ];
      });
    });

    prEventSource.addEventListener("reasoning_chunk", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          const msg = updated[i];
          if (msg.type === "agent" && msg.agent === data.agent) {
            updated[i] = {
              ...msg,
              reasoningChunks: [...msg.reasoningChunks, data.chunk],
            };
            break;
          }
        }
        return updated;
      });
    });

    prEventSource.addEventListener("agent_complete", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          const msg = updated[i];
          if (msg.type === "agent" && msg.agent === data.agent) {
            updated[i] = { ...msg, status: "done", summary: data.summary };
            break;
          }
        }
        return updated;
      });
    });

    prEventSource.addEventListener("qa_violations", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const qaViols = (data.violations || []).map((v: Record<string, unknown>, idx: number) => ({
        ...v,
        id: (v.violation_id || v.id || `qa-${data.iteration}-${idx}`) as string,
        severity: v.severity || "medium",
        approved: false,
      }));
      setMessages((prev) => [
        ...prev,
        {
          type: "qa_violations",
          violations: qaViols as Violation[],
          iteration: data.iteration,
        },
      ]);
    });

    prEventSource.addEventListener("pr_complete", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "pr_loading"),
        {
          type: "pr_status",
          prUrl: data.pr_url,
          branch: data.branch,
          violationCount: data.violation_count,
          qaIterations: data.qa_iterations,
        },
      ]);
      setPrLoading(false);
      prEventSource.close();
    });

    prEventSource.addEventListener("pr_error", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setPrLoading(false);
      setPrError(data.message);
      setMessages((prev) => prev.filter((m) => m.type !== "pr_loading"));
      prEventSource.close();
    });

    prEventSource.onerror = () => {
      setPrLoading(false);
      setPrError("PR pipeline connection failed. Check backend logs and try again.");
      setMessages((prev) => prev.filter((m) => m.type !== "pr_loading"));
      prEventSource.close();
    };
  };

  /* ---------------------------------------------------------------- */
  /*  Chat (advisor questions)                                        */
  /* ---------------------------------------------------------------- */

  const handleSendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || chatStreaming) return;
      const token = await getIdToken();
      if (!token) return;

      setMessages((prev) => [...prev, { type: "user", content: question }]);
      setChatInput("");
      setChatStreaming(true);

      const assistantId = `asst-${Date.now()}`;
      setMessages((prev) => [...prev, { type: "assistant", id: assistantId, content: "" }]);

      const url = getChatStreamUrl(token, scanId, question);
      const chatES = new EventSource(url);

      chatES.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.chunk) {
          setMessages((prev) => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (
                updated[i].type === "assistant" &&
                (updated[i] as { type: "assistant"; id: string; content: string }).id === assistantId
              ) {
                const msg = updated[i] as { type: "assistant"; id: string; content: string };
                updated[i] = { ...msg, content: msg.content + data.chunk };
                break;
              }
            }
            return updated;
          });
        }
      };

      chatES.addEventListener("done", () => {
        chatES.close();
        setChatStreaming(false);
      });
      chatES.addEventListener("error", () => {
        chatES.close();
        setChatStreaming(false);
      });
      chatES.onerror = () => {
        chatES.close();
        setChatStreaming(false);
      };
    },
    [getIdToken, scanId, chatStreaming]
  );

  /* ---------------------------------------------------------------- */
  /*  Derived                                                         */
  /* ---------------------------------------------------------------- */

  const isStreaming = scanStatus === "streaming" || scanStatus === "connecting";

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Back link */}
      <div className="px-4 pt-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-warm-grey-500 hover:text-warm-grey-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Header card */}
      <div className="px-4 pt-4">
        <div className="mx-auto">
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
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {scanStatus === "completed" && (
                  <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />
                )}
                {scanStatus === "failed" && (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                {isStreaming && (
                  <Loader2 className="h-5 w-5 text-warm-brown-500 animate-spin" />
                )}
                <span className="text-sm font-medium capitalize text-warm-grey-800">
                  {scanStatus === "connecting" ? "Starting..." : scanStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline (scrollable) */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto space-y-4">
          {messages.map((msg, i) => {
            switch (msg.type) {
              case "agent":
                return (
                  <AgentReasoningCard
                    key={msg.id}
                    agent={msg.agent}
                    status={msg.status}
                    reasoningChunks={msg.reasoningChunks}
                    summary={msg.summary}
                  />
                );
              case "violations":
                return (
                  <ViolationsWidget
                    key="violations"
                    violations={violations}
                    approvedIds={approvedIds}
                    onApprove={handleApprove}
                    onApproveAll={handleApproveAll}
                    onCreatePRs={handleCreatePRs}
                    onAskAbout={(v) =>
                      setChatInput(
                        `Explain the violation in ${v.file} line ${v.line}: ${v.description}`
                      )
                    }
                    prLoading={prLoading}
                    isStreaming={isStreaming}
                  />
                );
              case "user":
                return (
                  <div key={`user-${i}`} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-warm-brown-500 px-3.5 py-2.5 text-sm text-white">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              case "assistant":
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-white border border-warm-grey-200 px-3.5 py-2.5 text-sm text-warm-grey-700">
                      <div className="prose prose-sm max-w-none leading-relaxed text-warm-grey-700 [&_p]:my-2 [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-1 [&_code]:bg-warm-grey-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-warm-grey-900 [&_pre]:text-warm-grey-100 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1 [&_strong]:text-warm-grey-900 [&_strong]:font-semibold [&_hr]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-warm-grey-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-warm-grey-500">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {chatStreaming && i === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-3.5 bg-warm-brown-400 animate-pulse ml-0.5 align-middle" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              case "qa_violations": {
                const qaGrouped = msg.violations.reduce<Record<string, Violation[]>>(
                  (acc, v) => {
                    const f = v.file || "unknown";
                    (acc[f] ||= []).push(v);
                    return acc;
                  },
                  {}
                );
                return (
                  <div key={`qa-viols-${msg.iteration}`} className="space-y-3">
                    <p className="text-xs font-medium text-warm-grey-500 px-1">
                      New violations found during QA iteration {msg.iteration}
                    </p>
                    {Object.entries(qaGrouped).map(([file, viols]) => (
                      <ViolationGroup
                        key={file}
                        file={file}
                        violations={viols}
                        approvedIds={new Set()}
                        onApprove={() => {}}
                        onAskAbout={() => {}}
                        readOnly
                      />
                    ))}
                  </div>
                );
              }
              case "pr_status":
                return (
                  <PRStatusCard
                    key="pr-status"
                    prUrl={msg.prUrl}
                    branch={msg.branch}
                    violationCount={msg.violationCount}
                    qaIterations={msg.qaIterations}
                  />
                );
              case "pr_loading":
                return (
                  <div
                    key="pr-loading"
                    className="flex items-center gap-2 rounded-2xl border border-warm-grey-200 bg-warm-grey-50 px-5 py-3.5"
                  >
                    <Loader2 className="h-5 w-5 text-warm-brown-500 animate-spin" />
                    <span className="text-sm text-warm-grey-600">
                      Starting PR pipeline...
                    </span>
                  </div>
                );
              default:
                return null;
            }
          })}

          {/* Starter prompts -- show after violations widget when no chat messages exist */}
          {scanStatus === "completed" &&
            violations.length > 0 &&
            !messages.some((m) => m.type === "user") && (
              <div className="space-y-2">
                {[
                  "Summarize the most critical issues",
                  "Which violations should I fix first?",
                  "Explain these regulations in plain English",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSendMessage(s)}
                    className="w-full rounded-xl border border-warm-grey-200 bg-white px-3 py-2 text-left text-xs text-warm-grey-600 hover:bg-warm-grey-100 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

          {/* Streaming empty state */}
          {isStreaming && messages.length === 0 && (
            <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-12 text-center">
              <Scan className="mx-auto h-8 w-8 text-warm-brown-400 animate-pulse" />
              <p className="mt-3 text-sm text-warm-grey-500">
                Starting compliance scan...
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
                No compliance violations were found.
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
        </div>
      </div>

      {/* Chat input (pinned to bottom) */}
      {scanStatus === "completed" && violations.length > 0 && (
        <div className="border-t border-warm-grey-200 bg-warm-white px-4 py-3">
          <div className="mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(chatInput);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about violations, regulations..."
                disabled={chatStreaming}
                className="flex-1 rounded-xl border border-warm-grey-200 bg-white px-3 py-2 text-sm text-warm-grey-900 placeholder:text-warm-grey-400 focus:outline-none focus:ring-2 focus:ring-warm-brown-300 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatStreaming}
                className="rounded-xl bg-warm-brown-500 p-2 text-white hover:bg-warm-brown-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {chatStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PR error toast */}
      {prError && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2">
          <div className="mx-auto">
            <p className="text-xs text-red-600">{prError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
