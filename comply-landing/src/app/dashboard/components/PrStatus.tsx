"use client";

import { motion } from "motion/react";
import { GitPullRequest, Loader2, ExternalLink, XCircle } from "lucide-react";

interface PrStatusProps {
  urls: string[];
  loading: boolean;
  error: string | null;
}

export default function PrStatus({ urls, loading, error }: PrStatusProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-dust-grey-200 bg-white/80 shadow-xl shadow-dust-grey-200/40 backdrop-blur-sm p-6"
    >
      <h3 className="flex items-center gap-2 font-display italic text-lg font-bold text-dust-grey-950">
        <GitPullRequest className="h-5 w-5 text-hunter-green-600" />
        Pull Requests
      </h3>

      <div className="mt-4">
        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-dust-grey-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Generating fixes...</span>
            </div>
            <div className="flex items-center gap-2 text-dust-grey-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Running QA checks...</span>
            </div>
            <div className="flex items-center gap-2 text-dust-grey-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Creating pull requests...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
            <XCircle className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success */}
        {!loading && !error && urls.length > 0 && (
          <div className="space-y-2">
            {urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-hunter-green-200 bg-hunter-green-50/50 px-4 py-3 text-sm font-medium text-hunter-green-700 hover:bg-hunter-green-100/50 transition-colors"
              >
                <GitPullRequest className="h-4 w-4" />
                <span className="flex-1 truncate">{url}</span>
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
              </a>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && urls.length === 0 && (
          <p className="text-sm text-dust-grey-500">
            No pull requests created yet.
          </p>
        )}
      </div>
    </motion.div>
  );
}
