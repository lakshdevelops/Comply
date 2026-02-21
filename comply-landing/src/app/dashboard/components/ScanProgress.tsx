"use client";

import { motion } from "motion/react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

interface ProgressStep {
  agent: string;
  action: string;
  output: string;
  status: string;
}

interface ScanProgressProps {
  steps: ProgressStep[];
}

const statusIcon = (status: string) => {
  switch (status) {
    case "done":
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />;
    case "running":
    case "in_progress":
      return <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />;
    default:
      return <Circle className="h-5 w-5 text-warm-grey-300" />;
  }
};

export default function ScanProgress({ steps }: ScanProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6"
    >
      <h3 className="font-display text-lg font-bold text-warm-grey-900">
        Reasoning Log
      </h3>
      <p className="mt-1 text-sm text-warm-grey-600">
        Chain-of-thought progress for this scan.
      </p>

      <div className="mt-5 relative">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-1 bottom-1 w-px bg-warm-grey-200" />

        <div className="space-y-4">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="relative flex items-start gap-3 pl-0"
            >
              <div className="relative z-10 flex-shrink-0 bg-warm-grey-50">
                {statusIcon(step.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-warm-grey-900">
                    {step.agent}
                  </span>
                  <span className="text-xs text-warm-grey-400">
                    {step.action}
                  </span>
                </div>
                {step.output && (
                  <p className="mt-0.5 text-xs text-warm-grey-600 truncate">
                    &ldquo;{step.output}&rdquo;
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
