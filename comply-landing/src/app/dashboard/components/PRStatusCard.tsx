"use client";

import { GitPullRequest, ExternalLink, CheckCircle2 } from "lucide-react";

interface PRStatusCardProps {
  prUrl: string;
  branch: string;
  violationCount: number;
  qaIterations: number;
}

export default function PRStatusCard({
  prUrl,
  branch,
  violationCount,
  qaIterations,
}: PRStatusCardProps) {
  return (
    <div className="rounded-2xl border border-warm-brown-200 bg-warm-brown-50/50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-warm-brown-600" />
        <span className="text-sm font-medium text-warm-grey-900">
          Pull Request Created
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-warm-grey-500">
        <span>
          Branch: <span className="text-warm-grey-700 font-mono">{branch}</span>
        </span>
        <span>
          {violationCount} violation{violationCount !== 1 ? "s" : ""} resolved
        </span>
        <span>
          QA: Clean after {qaIterations} iteration{qaIterations !== 1 ? "s" : ""}
        </span>
      </div>

      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-warm-brown-200 bg-white px-4 py-2.5 text-sm font-medium text-warm-brown-700 hover:bg-warm-brown-50 transition-colors"
      >
        <GitPullRequest className="h-4 w-4" />
        <span className="truncate">View on GitHub</span>
        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
      </a>
    </div>
  );
}
