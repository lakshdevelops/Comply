"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { getWorkspaceScan, listScanFindings, listScanPlans, approvePlan } from "@/lib/api";
import type { WorkspaceScan, Finding, FixPlan } from "@/types/comply";

const severityColor: Record<string, string> = {
  P0: "bg-red-100 text-red-700 border-red-200",
  P1: "bg-orange-100 text-orange-700 border-orange-200",
  P2: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

export default function WorkspaceScanPage() {
  const { id: workspaceId, scanId } = useParams<{ id: string; scanId: string }>();
  const [scan, setScan] = useState<WorkspaceScan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [plans, setPlans] = useState<FixPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, f, p] = await Promise.all([
          getWorkspaceScan(workspaceId, scanId),
          listScanFindings(workspaceId, scanId),
          listScanPlans(workspaceId, scanId),
        ]);
        setScan(s);
        setFindings(f);
        setPlans(p);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [workspaceId, scanId]);

  const handleApprove = async (planId: string) => {
    await approvePlan(workspaceId, scanId, planId);
    setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, approved: true } : p)));
  };

  if (loading) return <div className="animate-pulse h-64 rounded-2xl bg-warm-grey-100" />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      <div className="text-sm text-warm-grey-500">
        <Link href="/dashboard/workspaces" className="hover:text-warm-grey-700">Workspaces</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <Link href={`/dashboard/workspaces/${workspaceId}`} className="hover:text-warm-grey-700">Workspace</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <span className="text-warm-grey-700">Scan</span>
      </div>

      <div className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
        <div className="flex items-center gap-3">
          {scan?.status === "completed" ? <CheckCircle className="h-6 w-6 text-green-500" /> :
           scan?.status === "failed" ? <AlertTriangle className="h-6 w-6 text-red-500" /> :
           <Clock className="h-6 w-6 text-warm-brown-500 animate-pulse" />}
          <div>
            <h2 className="font-display text-xl font-bold text-warm-grey-900 capitalize">Scan {scan?.status}</h2>
            <p className="text-sm text-warm-grey-500">Started {scan?.startedAt}</p>
          </div>
        </div>
        {scan?.summary && (
          <div className="mt-4 flex gap-3">
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">P0: {scan.summary.p0}</span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">P1: {scan.summary.p1}</span>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">P2: {scan.summary.p2}</span>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-warm-grey-900 mb-4">Findings ({findings.length})</h3>
        <div className="space-y-3">
          {findings.map((f) => {
            const plan = plans.find((p) => p.findingId === f.id);
            return (
              <div key={f.id} className="rounded-xl border border-warm-grey-200 bg-warm-grey-50 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${severityColor[f.severity]}`}>{f.severity}</span>
                      <span className="text-xs text-warm-grey-400 font-mono">{f.regulationRef}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-warm-grey-900">{f.title}</h4>
                    <p className="mt-1 text-xs text-warm-grey-600">{f.description}</p>
                    <p className="mt-1 text-xs text-warm-grey-400 font-mono">{f.filePath}:{f.lineStart}</p>
                  </div>
                  {plan && !plan.approved && (
                    <button onClick={() => handleApprove(plan.id)}
                      className="ml-4 rounded-lg bg-warm-brown-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-warm-brown-600 transition-colors"
                    >Approve Fix</button>
                  )}
                  {plan?.approved && (
                    <span className="ml-4 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">Approved</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
