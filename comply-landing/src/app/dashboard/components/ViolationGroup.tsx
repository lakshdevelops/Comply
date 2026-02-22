"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  MessageSquare,
} from "lucide-react";

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

interface ViolationGroupProps {
  file: string;
  violations: Violation[];
  approvedIds: Set<string>;
  onApprove: (id: string) => void;
  onAskAbout: (violation: Violation) => void;
  readOnly?: boolean;
}

const severityConfig = {
  critical: {
    label: "CRIT",
    badgeClass: "bg-red-100 text-red-700",
    dotColor: "bg-red-500",
  },
  high: {
    label: "HIGH",
    badgeClass: "bg-orange-100 text-orange-700",
    dotColor: "bg-orange-500",
  },
  medium: {
    label: "MED",
    badgeClass: "bg-yellow-100 text-yellow-700",
    dotColor: "bg-yellow-500",
  },
};

export default function ViolationGroup({
  file,
  violations,
  approvedIds,
  onApprove,
  onAskAbout,
  readOnly = false,
}: ViolationGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const approvedCount = violations.filter((v) => approvedIds.has(v.id)).length;

  return (
    <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 overflow-hidden">
      {/* File header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-warm-grey-100 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-warm-grey-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-warm-grey-400" />
        )}
        <FileText className="h-4 w-4 text-warm-brown-500" />
        <span className="flex-1 text-sm font-medium text-warm-grey-900 truncate">
          {file}
        </span>
        {!readOnly && (
          <span className="text-xs text-warm-grey-500">
            {approvedCount}/{violations.length} approved
          </span>
        )}
        <span className="rounded-full bg-warm-grey-200 px-2 py-0.5 text-xs font-medium text-warm-grey-700">
          {violations.length}
        </span>
      </button>

      {/* Violation rows */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-warm-grey-200">
              {violations.map((v) => {
                const config =
                  severityConfig[v.severity] || severityConfig.medium;
                const isApproved = approvedIds.has(v.id);
                const isExpanded = expandedRow === v.id;

                return (
                  <div key={v.id} className="border-b border-warm-grey-100 last:border-b-0">
                    {/* Compact row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedRow(isExpanded ? null : v.id)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedRow(isExpanded ? null : v.id);
                        }
                      }}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-warm-grey-100/50 transition-colors cursor-pointer"
                    >
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${config.badgeClass}`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${config.dotColor}`}
                        />
                        {config.label}
                      </span>
                      <span className="flex-1 text-sm text-warm-grey-700 truncate">
                        {v.description}
                      </span>
                      {!readOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onApprove(v.id);
                          }}
                          className={`flex-shrink-0 rounded-lg p-1 transition-colors ${
                            isApproved
                              ? "text-warm-brown-500"
                              : "text-warm-grey-300 hover:text-warm-grey-500"
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 pt-1 space-y-3 bg-white/50">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-warm-grey-500">
                              <span>Line {v.line}</span>
                              {v.resource && (
                                <span>
                                  Resource:{" "}
                                  <span className="text-warm-grey-700">
                                    {v.resource}
                                  </span>
                                </span>
                              )}
                              {v.estimated_effort && (
                                <span>
                                  Effort:{" "}
                                  <span className="text-warm-grey-700">
                                    {v.estimated_effort}
                                  </span>
                                </span>
                              )}
                              {v.priority && (
                                <span>
                                  Priority:{" "}
                                  <span className="text-warm-grey-700">
                                    {v.priority}
                                  </span>
                                </span>
                              )}
                            </div>

                            {v.explanation && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-warm-grey-400">
                                  What&apos;s Wrong
                                </p>
                                <p className="mt-1 text-sm text-warm-grey-700">
                                  {v.explanation}
                                </p>
                              </div>
                            )}

                            {v.regulation_citation && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-warm-grey-400">
                                  Regulation
                                </p>
                                <p className="mt-1 text-sm text-warm-grey-700 font-mono">
                                  {v.regulation_citation}
                                </p>
                              </div>
                            )}

                            {v.what_needs_to_change && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-warm-grey-400">
                                  Proposed Change
                                </p>
                                <p className="mt-1 text-sm text-warm-grey-700">
                                  {v.what_needs_to_change}
                                </p>
                              </div>
                            )}

                            {v.sample_fix && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-warm-grey-400">
                                  Sample Fix
                                </p>
                                <div className="mt-1 rounded-lg bg-warm-grey-900 p-3">
                                  <pre className="overflow-x-auto text-xs text-warm-grey-100 font-mono whitespace-pre-wrap">
                                    {v.sample_fix}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {!readOnly && (
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => onAskAbout(v)}
                                  className="flex items-center gap-1.5 rounded-lg border border-warm-grey-300 bg-warm-grey-100 px-3 py-1.5 text-xs font-medium text-warm-grey-700 hover:bg-warm-grey-200 transition-colors"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  Ask about this
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
