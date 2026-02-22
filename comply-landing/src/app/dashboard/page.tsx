"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import RepoConnect from "./components/RepoConnect";
import ScanHistory from "./components/ScanHistory";
import MiroConnect from "./components/MiroConnect";

export default function DashboardPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8"
    >
      <div>
        <h1 className="font-display text-2xl font-bold text-warm-grey-900">
          Compliance Dashboard
        </h1>
        <p className="mt-1 text-sm text-warm-grey-600">
          Connect your repository, scan for compliance violations, and ship
          fixes.
        </p>
      </div>

      {/* Document Compliance */}
      <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6 hover:border-warm-brown-300/60 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-brown-100">
              <Building2 className="h-5 w-5 text-warm-brown-600" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-warm-grey-900">Document Compliance</h3>
              <p className="mt-0.5 text-sm text-warm-grey-600">
                Create workspaces, upload documents, and scan for regulatory compliance.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/workspaces"
            className="inline-flex items-center gap-2 rounded-xl bg-warm-brown-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-warm-brown-600 transition-colors"
          >
            Open Workspaces
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RepoConnect />
        <MiroConnect />
      </div>
      <ScanHistory />
    </motion.div>
  );
}
