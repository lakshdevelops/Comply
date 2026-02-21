"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getScans } from "@/lib/api";

interface Scan {
  id: string;
  repo_owner: string;
  repo_name: string;
  status: "scanning" | "completed" | "failed";
  violation_count: number;
  created_at: string;
}

export default function ScanHistory() {
  const { getIdToken } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await getScans(token);
      setScans(data.scans || []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const statusConfig = {
    completed: {
      icon: <CheckCircle2 className="h-4 w-4 text-hunter-green-600" />,
      label: "Completed",
      badgeClass:
        "border-hunter-green-300/50 bg-hunter-green-100/40 text-hunter-green-700",
    },
    failed: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      label: "Failed",
      badgeClass: "border-red-300/50 bg-red-100/40 text-red-700",
    },
    scanning: {
      icon: <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />,
      label: "Scanning",
      badgeClass: "border-yellow-300/50 bg-yellow-100/40 text-yellow-700",
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-2xl border border-dust-grey-200 bg-white/80 shadow-xl shadow-dust-grey-200/40 backdrop-blur-sm p-6"
    >
      <h2 className="font-display italic text-xl font-bold text-dust-grey-950">
        Scan History
      </h2>
      <p className="mt-1 text-sm text-dust-grey-600">
        Previous compliance scans and their results.
      </p>

      <div className="mt-5">
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-dust-grey-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading scans...</span>
          </div>
        )}

        {!loading && scans.length === 0 && (
          <div className="py-12 text-center">
            <Clock className="mx-auto h-8 w-8 text-dust-grey-300" />
            <p className="mt-3 text-sm text-dust-grey-500">
              No scans yet. Connect a repo and run your first scan.
            </p>
          </div>
        )}

        {!loading && scans.length > 0 && (
          <div className="space-y-2">
            {scans.map((scan) => {
              const config = statusConfig[scan.status];
              return (
                <Link
                  key={scan.id}
                  href={`/dashboard/scan/${scan.id}`}
                  className="group flex items-center justify-between rounded-xl border border-dust-grey-200 bg-white px-4 py-3 hover:border-dust-grey-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    {config.icon}
                    <div>
                      <p className="text-sm font-medium text-dust-grey-900">
                        {scan.repo_owner}/{scan.repo_name}
                      </p>
                      <p className="text-xs text-dust-grey-500">
                        {new Date(scan.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.badgeClass}`}
                    >
                      {config.label}
                    </span>
                    {scan.status === "completed" && (
                      <span className="flex items-center gap-1 text-xs text-dust-grey-500">
                        <AlertTriangle className="h-3 w-3" />
                        {scan.violation_count} violation
                        {scan.violation_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-dust-grey-400 group-hover:text-dust-grey-600 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
