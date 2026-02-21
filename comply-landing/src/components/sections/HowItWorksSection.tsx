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
    agentColor: "bg-warm-grey-300",
  },
  {
    number: "02",
    icon: Bot,
    title: "Agents Audit & Plan",
    description:
      "The Auditor scans, the Strategist prioritises, and the Legal Advisor flags regulatory risks — all autonomously.",
    detail: "Agents resolve conflicts and cross-validate findings in real time.",
    agentColor: "bg-warm-brown-300",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Fix & Monitor",
    description:
      "Comply generates pull requests for every issue and tracks your compliance score continuously.",
    detail: "Review and merge — we handle the rest.",
    agentColor: "bg-warm-brown-200",
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
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-warm-brown-500">
            How It Works
          </p>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-warm-grey-900 sm:text-3xl">
            Three steps to full compliance
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-warm-grey-600">
            From zero to compliant in minutes — not months of manual auditing.
          </p>
        </motion.div>

        {/* Step cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 relative">
          {/* Connector lines (desktop only) */}
          <div className="absolute top-12 left-1/3 right-1/3 hidden h-px bg-gradient-to-r from-transparent via-warm-brown-300/40 to-transparent lg:block pointer-events-none" />
          <div className="absolute top-12 left-2/3 right-0 hidden h-px bg-gradient-to-r from-transparent via-warm-brown-300/40 to-transparent lg:block pointer-events-none" />
          <div className="absolute top-12 left-0 right-2/3 hidden h-px bg-gradient-to-r from-transparent via-warm-brown-300/40 to-transparent lg:block pointer-events-none" />

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="group relative flex flex-col gap-4 rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-7 hover:border-warm-brown-300/60 transition-colors"
            >
              {/* Step number + icon row */}
              <div className="flex items-center justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.agentColor}`}>
                  <step.icon className="h-5 w-5 text-warm-grey-900" />
                </div>
                <span className="font-mono text-4xl font-black text-warm-grey-200 select-none">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <h3 className="font-display text-xl font-bold text-warm-grey-900">{step.title}</h3>
              <p className="text-warm-grey-600 text-sm leading-relaxed">{step.description}</p>
              <p className="text-xs text-warm-grey-400 italic">{step.detail}</p>

              {/* Arrow on desktop */}
              {i < steps.length - 1 && (
                <div className="absolute -right-3 top-12 z-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-warm-brown-300/40 bg-warm-grey-100">
                  <ArrowRight className="h-3 w-3 text-warm-brown-500" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
