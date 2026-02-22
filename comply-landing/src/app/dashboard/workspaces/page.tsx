"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Plus, Building2, Shield, Cloud } from "lucide-react";
import { listWorkspaces } from "@/lib/api";
import type { Workspace } from "@/types/comply";

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-warm-grey-900">Workspaces</h1>
          <p className="mt-1 text-sm text-warm-grey-600">Manage client workspaces and compliance scans.</p>
        </div>
        <Link
          href="/dashboard/workspaces/new"
          className="inline-flex items-center gap-2 rounded-xl bg-warm-brown-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-warm-brown-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Workspace
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-warm-grey-100" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-warm-grey-300 p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-warm-grey-400" />
          <p className="mt-3 text-warm-grey-600">No workspaces yet.</p>
          <Link
            href="/dashboard/workspaces/new"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-warm-brown-600 hover:text-warm-brown-700"
          >
            <Plus className="h-4 w-4" /> Create your first workspace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Link key={ws.id} href={`/dashboard/workspaces/${ws.id}`}>
              <div className="group rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6 hover:border-warm-brown-300/60 transition-colors">
                <h3 className="font-display text-lg font-bold text-warm-grey-900">{ws.client_name}</h3>
                <p className="mt-1 text-sm text-warm-grey-500">{ws.client_industry}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {ws.compliance_frameworks.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded-full bg-warm-brown-100 px-2 py-0.5 text-xs font-medium text-warm-brown-700">
                      <Shield className="h-3 w-3" />{f}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-warm-grey-400">
                  <Cloud className="h-3 w-3" />{ws.cloud_provider} · {ws.infrastructure_type}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
