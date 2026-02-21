"use client";

import { motion } from "motion/react";
import { Brain, GitPullRequest, BarChart3, RefreshCw, Lock, Layers } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Agent Team",
    description:
      "Three specialist agents — Auditor, Strategist, and Legal Advisor — reason together 24/7, cross-validating every finding.",
    badge: "AI-Powered",
  },
  {
    icon: GitPullRequest,
    title: "Automated Pull Requests",
    description:
      "Comply opens structured PRs with context, references, and rollback notes. You review; it applies.",
    badge: "GitHub Native",
  },
  {
    icon: BarChart3,
    title: "Real-Time Insights",
    description:
      "Live compliance score, risk heatmap, and trend charts so you always know your security posture at a glance.",
    badge: "Live Data",
  },
  {
    icon: RefreshCw,
    title: "Continuous Monitoring",
    description:
      "Re-audits automatically on every push. Drift is caught the moment it happens — never at the next quarterly review.",
    badge: "Always-On",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description:
      "OAuth-scoped access, zero credential storage, and audit log trails — security-first by design.",
    badge: "SOC 2 Ready",
  },
  {
    icon: Layers,
    title: "Multi-Framework Support",
    description:
      "Works with Terraform, Kubernetes, CloudFormation, Pulumi, and raw IaC. Any repo, any stack.",
    badge: "Any Stack",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 right-0 h-96 w-[600px] rounded-full bg-pine-teal-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-hunter-green-500">
            Features
          </p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-dust-grey-950 sm:text-5xl">
            Enterprise-grade compliance,{" "}
            <span className="gradient-text">fully automated</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-dry-sage-600">
            Everything a compliance team needs — without the team.
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.12 }}
              whileHover={{ y: -4 }}
              className="group relative flex flex-col gap-4 rounded-2xl border border-dust-grey-200 bg-dust-grey-100/60 p-7 hover:border-hunter-green-400/60 transition-colors cursor-default"
            >
              {/* Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-hunter-green-200/40 text-hunter-green-600 group-hover:bg-hunter-green-200/70 transition-colors">
                <feature.icon className="h-5 w-5" />
              </div>

              {/* Badge */}
              <span className="inline-flex w-fit items-center rounded-full border border-dust-grey-300/50 bg-dust-grey-200/50 px-2.5 py-0.5 text-xs font-medium text-dry-sage-600">
                {feature.badge}
              </span>

              {/* Text */}
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-dust-grey-950">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-dry-sage-600">{feature.description}</p>
              </div>

              {/* Hover glow edge */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ring-1 ring-hunter-green-400/30" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
