"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { createWorkspace } from "@/lib/api";
import type { ComplianceFramework, CloudProvider, InfrastructureType } from "@/types/comply";

const FRAMEWORKS: ComplianceFramework[] = ["GDPR", "DORA", "ISO27001", "SOC2", "HIPAA", "PCI-DSS"];
const CLOUDS: CloudProvider[] = ["AWS", "Azure", "GCP", "Multi-Cloud"];
const INFRA_TYPES: InfrastructureType[] = ["Terraform", "Kubernetes", "CloudFormation", "Mixed"];

export default function NewWorkspacePage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientIndustry, setClientIndustry] = useState("");
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [cloud, setCloud] = useState<CloudProvider>("AWS");
  const [infra, setInfra] = useState<InfrastructureType>("Terraform");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleFramework = (f: ComplianceFramework) => {
    setFrameworks((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientIndustry || frameworks.length === 0) {
      setError("Please fill all fields and select at least one framework.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const ws = await createWorkspace({
        client_name: clientName,
        client_industry: clientIndustry,
        compliance_frameworks: frameworks,
        cloud_provider: cloud,
        infrastructure_type: infra,
      });
      router.push(`/dashboard/workspaces/${ws.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div>
        <h1 className="font-display text-2xl font-bold text-warm-grey-900">Create Workspace</h1>
        <p className="mt-1 text-sm text-warm-grey-600">Set up a new client workspace for compliance scanning.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-4 rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6">
          <div>
            <label className="block text-sm font-medium text-warm-grey-700 mb-1">Client Name</label>
            <input
              type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm focus:border-warm-brown-400 focus:outline-none focus:ring-1 focus:ring-warm-brown-400"
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-grey-700 mb-1">Industry</label>
            <input
              type="text" value={clientIndustry} onChange={(e) => setClientIndustry(e.target.value)}
              className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm focus:border-warm-brown-400 focus:outline-none focus:ring-1 focus:ring-warm-brown-400"
              placeholder="Financial Services"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-grey-700 mb-2">Compliance Frameworks</label>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORKS.map((f) => (
                <button key={f} type="button" onClick={() => toggleFramework(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    frameworks.includes(f)
                      ? "bg-warm-brown-500 text-white"
                      : "bg-warm-grey-100 text-warm-grey-600 hover:bg-warm-grey-200"
                  }`}
                >{f}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-warm-grey-700 mb-1">Cloud Provider</label>
              <select value={cloud} onChange={(e) => setCloud(e.target.value as CloudProvider)}
                className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm focus:border-warm-brown-400 focus:outline-none"
              >
                {CLOUDS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-grey-700 mb-1">Infrastructure Type</label>
              <select value={infra} onChange={(e) => setInfra(e.target.value as InfrastructureType)}
                className="w-full rounded-lg border border-warm-grey-200 bg-white px-3 py-2 text-sm focus:border-warm-brown-400 focus:outline-none"
              >
                {INFRA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button type="submit" disabled={submitting}
          className="w-full rounded-xl bg-warm-brown-500 py-3 text-sm font-semibold text-white hover:bg-warm-brown-600 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating..." : "Create Workspace"}
        </button>
      </form>
    </motion.div>
  );
}
