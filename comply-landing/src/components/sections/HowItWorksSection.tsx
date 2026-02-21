"use client";

import { motion } from "motion/react";
import { GitBranch, Bot, ShieldCheck, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: GitBranch,
    title: "Connect Repository",
    description:
      "Securely link your GitHub repo via OAuth. No manual uploads, no config files — just click and connect.",
    detail: "Supports monorepos, Terraform, Kubernetes, and more.",
    agentColor: "bg-dust-grey-300",
  },
  {
    number: "02",
    icon: Bot,
    title: "Agents Audit & Plan",
    description:
      "The Auditor scans, the Strategist prioritises, and the Legal Advisor flags regulatory risks — all autonomously.",
    detail: "Agents resolve conflicts and cross-validate findings in real time.",
    agentColor: "bg-hunter-green-300",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Fix & Monitor",
    description:
      "Comply generates pull requests for every issue and tracks your compliance score continuously.",
    detail: "Review and merge — we handle the rest.",
    agentColor: "bg-dry-sage-300",
  },
];

const agents = [
  {
    name: "Auditor",
    role: "Scans & detects",
    color: "bg-dust-grey-300",
    border: "border-dust-grey-400/40",
    initial: "A",
    messages: ["Scanning infra/terraform...", "Found 7 violations", "Severity: 3 critical"],
  },
  {
    name: "Strategist",
    role: "Prioritises & plans",
    color: "bg-hunter-green-300",
    border: "border-hunter-green-400/40",
    initial: "S",
    messages: ["Reviewing findings...", "Plan: fix S3 policy first", "PR draft ready"],
  },
  {
    name: "Legal Advisor",
    role: "Checks compliance",
    color: "bg-dry-sage-300",
    border: "border-dry-sage-400/40",
    initial: "L",
    messages: ["Checking SOC 2...", "GDPR gap found", "Adding remediation note"],
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-hunter-green-500">
            How It Works
          </p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-dust-grey-950 sm:text-5xl">
            Three steps to full compliance
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-dry-sage-600">
            From zero to compliant in minutes — not months of manual auditing.
          </p>
        </motion.div>

        {/* Step cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 relative">
          {/* Connector lines (desktop only) */}
          <div className="absolute top-12 left-1/3 right-1/3 hidden h-px bg-gradient-to-r from-transparent via-hunter-green-300/40 to-transparent lg:block pointer-events-none" />
          <div className="absolute top-12 left-2/3 right-0 hidden h-px bg-gradient-to-r from-transparent via-hunter-green-300/40 to-transparent lg:block pointer-events-none" />
          <div className="absolute top-12 left-0 right-2/3 hidden h-px bg-gradient-to-r from-transparent via-hunter-green-300/40 to-transparent lg:block pointer-events-none" />

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="group relative flex flex-col gap-4 rounded-2xl border border-dust-grey-200 bg-dust-grey-100/60 p-7 hover:border-hunter-green-300/60 transition-colors"
            >
              {/* Step number + icon row */}
              <div className="flex items-center justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.agentColor}`}>
                  <step.icon className="h-5 w-5 text-dust-grey-900" />
                </div>
                <span className="font-mono text-4xl font-black text-dust-grey-200 select-none">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <h3 className="font-display text-xl font-bold text-dust-grey-950">{step.title}</h3>
              <p className="text-dry-sage-600 text-sm leading-relaxed">{step.description}</p>
              <p className="text-xs text-dust-grey-400 italic">{step.detail}</p>

              {/* Arrow on desktop */}
              {i < steps.length - 1 && (
                <div className="absolute -right-3 top-12 z-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-hunter-green-300/40 bg-dust-grey-100">
                  <ArrowRight className="h-3 w-3 text-hunter-green-500" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Agent illustration strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 hidden lg:grid grid-cols-3 gap-6"
        >
          {agents.map((agent, i) => (
            <div
              key={agent.name}
              className={`rounded-xl border ${agent.border} bg-dust-grey-50/60 p-4 space-y-3`}
            >
              {/* Agent header */}
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${agent.color} text-sm font-bold text-white`}>
                  {agent.initial}
                </div>
                <div>
                  <p className="text-sm font-semibold text-dust-grey-900">{agent.name}</p>
                  <p className="text-xs text-dry-sage-500">{agent.role}</p>
                </div>
                <div className="ml-auto h-2 w-2 rounded-full bg-hunter-green-600 animate-pulse" />
              </div>
              {/* Skeleton messages */}
              {agent.messages.map((msg, j) => (
                <div key={j} className="rounded-md bg-dust-grey-200/50 px-3 py-2">
                  <p className="text-xs text-dry-sage-600 font-mono">{msg}</p>
                </div>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
