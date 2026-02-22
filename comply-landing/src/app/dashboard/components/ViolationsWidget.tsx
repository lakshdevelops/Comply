"use client";

import { useState } from "react";
import ViolationGroup from "./ViolationGroup";

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

interface ViolationsWidgetProps {
  violations: Violation[];
  approvedIds: Set<string>;
  onApprove: (id: string) => void;
  onApproveAll: () => void;
  onCreatePRs: () => void;
  onAskAbout: (violation: Violation) => void;
  prLoading: boolean;
  isStreaming: boolean;
}

export default function ViolationsWidget({
  violations,
  approvedIds,
  onApprove,
  onApproveAll,
  onCreatePRs,
  onAskAbout,
  prLoading,
  isStreaming,
}: ViolationsWidgetProps) {
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const filteredViolations =
    severityFilter === "all"
      ? violations
      : violations.filter((v) => v.severity === severityFilter);

  const groupedByFile = filteredViolations.reduce<Record<string, Violation[]>>(
    (acc, v) => {
      const f = v.file || "unknown";
      (acc[f] ||= []).push(v);
      return acc;
    },
    {}
  );
  const fileGroups = Object.entries(groupedByFile);

  return (
    <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {["all", "critical", "high", "medium"].map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              severityFilter === sev
                ? "bg-warm-brown-500 text-white"
                : "bg-warm-grey-100 text-warm-grey-600 hover:bg-warm-grey-200"
            }`}
          >
            {sev === "all"
              ? `All (${violations.length})`
              : sev.charAt(0).toUpperCase() + sev.slice(1)}
          </button>
        ))}
        {!isStreaming && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-warm-grey-500">
              {approvedIds.size} of {violations.length} approved
            </span>
            <button
              onClick={onApproveAll}
              className="rounded-xl bg-warm-brown-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-warm-brown-600 transition-colors"
            >
              {approvedIds.size === violations.length
                ? "Deselect All"
                : "Approve All"}
            </button>
            <button
              onClick={onCreatePRs}
              disabled={approvedIds.size === 0 || prLoading}
              className="rounded-xl bg-warm-brown-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-warm-brown-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prLoading ? "Creating..." : "Create PRs"}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {fileGroups.map(([file, viols]) => (
          <ViolationGroup
            key={file}
            file={file}
            violations={viols}
            approvedIds={approvedIds}
            onApprove={onApprove}
            onAskAbout={onAskAbout}
          />
        ))}
      </div>
    </div>
  );
}
