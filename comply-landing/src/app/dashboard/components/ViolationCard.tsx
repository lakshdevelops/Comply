"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  Code,
  BookOpen,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { explainRegulation } from "@/lib/api";

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
}

interface ViolationCardProps {
  violation: Violation;
  isApproved: boolean;
  onApprove: () => void;
}

const severityConfig = {
  critical: {
    label: "CRITICAL",
    borderColor: "border-l-red-500",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    dotColor: "bg-red-500",
  },
  high: {
    label: "HIGH",
    borderColor: "border-l-orange-500",
    badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
    dotColor: "bg-orange-500",
  },
  medium: {
    label: "MEDIUM",
    borderColor: "border-l-yellow-500",
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dotColor: "bg-yellow-500",
  },
};

export default function ViolationCard({
  violation,
  isApproved,
  onApprove,
}: ViolationCardProps) {
  const { getIdToken } = useAuth();
  const [showFix, setShowFix] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const config = severityConfig[violation.severity] || severityConfig.medium;

  const handleExplain = async () => {
    if (explanation) {
      setShowExplanation(!showExplanation);
      return;
    }

    setExplainLoading(true);
    setShowExplanation(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const result = await explainRegulation(
        token,
        violation.regulation_citation
      );
      setExplanation(result.explanation);
    } catch {
      setExplanation("Failed to load regulation explanation.");
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-dust-grey-200 border-l-4 ${
        isApproved ? "border-l-hunter-green-500" : config.borderColor
      } bg-white/80 shadow-xl shadow-dust-grey-200/40 backdrop-blur-sm p-6 transition-colors`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
              {config.label}
            </span>
            {isApproved && (
              <span className="inline-flex items-center gap-1 rounded-full border border-hunter-green-300/50 bg-hunter-green-100/40 px-2 py-0.5 text-[10px] font-medium text-hunter-green-700">
                <CheckCircle2 className="h-3 w-3" />
                Approved
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-medium text-dust-grey-950">
            {violation.description}
          </p>
        </div>
      </div>

      {/* File info */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dust-grey-500">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {violation.file} (line {violation.line})
        </span>
        {violation.resource && (
          <span>
            Resource: <span className="text-dust-grey-700">{violation.resource}</span>
          </span>
        )}
      </div>

      {/* Details */}
      <div className="mt-4 space-y-3">
        {violation.explanation && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-dust-grey-400">
              What&apos;s Wrong
            </p>
            <p className="mt-1 text-sm text-dust-grey-700">
              {violation.explanation}
            </p>
          </div>
        )}

        {violation.regulation_citation && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-dust-grey-400">
              Regulation
            </p>
            <p className="mt-1 text-sm text-dust-grey-700 font-mono">
              {violation.regulation_citation}
            </p>
          </div>
        )}

        {violation.what_needs_to_change && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-dust-grey-400">
              Proposed Change
            </p>
            <p className="mt-1 text-sm text-dust-grey-700">
              {violation.what_needs_to_change}
            </p>
          </div>
        )}
      </div>

      {/* Effort + Priority */}
      <div className="mt-3 flex items-center gap-4 text-xs text-dust-grey-500">
        {violation.estimated_effort && (
          <span>
            Effort:{" "}
            <span className="font-medium text-dust-grey-700">
              {violation.estimated_effort}
            </span>
          </span>
        )}
        {violation.priority && (
          <span>
            Priority:{" "}
            <span className="font-medium text-dust-grey-700">
              {violation.priority}
            </span>
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dust-grey-100 pt-4">
        <button
          onClick={handleExplain}
          className="flex items-center gap-1.5 rounded-xl border border-dust-grey-300 bg-white px-3 py-1.5 text-xs font-medium text-dust-grey-800 hover:bg-dust-grey-50 transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Explain Regulation
          <ChevronDown
            className={`h-3 w-3 transition-transform ${
              showExplanation ? "rotate-180" : ""
            }`}
          />
        </button>
        <button
          onClick={() => setShowFix(!showFix)}
          className="flex items-center gap-1.5 rounded-xl border border-dust-grey-300 bg-white px-3 py-1.5 text-xs font-medium text-dust-grey-800 hover:bg-dust-grey-50 transition-colors"
        >
          <Code className="h-3.5 w-3.5" />
          View Sample Fix
          <ChevronDown
            className={`h-3 w-3 transition-transform ${
              showFix ? "rotate-180" : ""
            }`}
          />
        </button>
        <button
          onClick={onApprove}
          className={`ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
            isApproved
              ? "bg-hunter-green-600 text-white hover:bg-hunter-green-700"
              : "border border-dust-grey-300 bg-white text-dust-grey-800 hover:bg-dust-grey-50"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isApproved ? "Approved" : "Approve Fix"}
        </button>
      </div>

      {/* Expandable: Regulation Explanation */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-dust-grey-200 bg-dust-grey-50 p-4">
              {explainLoading ? (
                <div className="flex items-center gap-2 text-dust-grey-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading explanation...</span>
                </div>
              ) : (
                <p className="text-sm text-dust-grey-700 whitespace-pre-wrap">
                  {explanation}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable: Sample Fix */}
      <AnimatePresence>
        {showFix && violation.sample_fix && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-dust-grey-200 bg-dust-grey-950 p-4">
              <pre className="overflow-x-auto text-xs text-dust-grey-100 font-mono whitespace-pre-wrap">
                {violation.sample_fix}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
