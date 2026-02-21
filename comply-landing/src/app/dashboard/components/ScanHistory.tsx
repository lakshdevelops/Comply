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
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getScans, deleteScan } from "@/lib/api";

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

  const handleDelete = async (e: React.MouseEvent, scanId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const token = await getIdToken();
    if (!token) return;
    try {
      await deleteScan(token, scanId);
      setScans((prev) => prev.filter((s) => s.id !== scanId));
    } catch {
      // silently handle
    }
  };

  const statusConfig = {
    completed: {
      icon: <CheckCircle2 className="h-4 w-4 text-warm-brown-600" />,
      label: "Completed",
      badgeClass:
        "border-warm-brown-300/50 bg-warm-brown-100/40 text-warm-brown-700",
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
      className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6"
    >
      <h2 className="font-display text-xl font-bold text-warm-grey-900">
        Scan History
      </h2>
      <p className="mt-1 text-sm text-warm-grey-600">
        Previous compliance scans and their results.
      </p>

      <div className="mt-5">
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-warm-grey-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading scans...</span>
          </div>
        )}

        {!loading && scans.length === 0 && (
          <div className="py-12 text-center">
            <Clock className="mx-auto h-8 w-8 text-warm-grey-300" />
            <p className="mt-3 text-sm text-warm-grey-500">
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
                  className="group flex items-center justify-between rounded-xl border border-warm-grey-200 bg-warm-grey-50 px-4 py-3 hover:border-warm-grey-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    {config.icon}
                    <div>
                      <p className="text-sm font-medium text-warm-grey-900">
                        {scan.repo_owner}/{scan.repo_name}
                      </p>
                      <p className="text-xs text-warm-grey-500">
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
                      <span className="flex items-center gap-1 text-xs text-warm-grey-500">
                        <AlertTriangle className="h-3 w-3" />
                        {scan.violation_count} violation
                        {scan.violation_count !== 1 ? "s" : ""}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, scan.id)}
                      className="rounded-lg p-1 text-warm-grey-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Delete scan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-warm-grey-400 group-hover:text-warm-grey-600 transition-colors" />
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
