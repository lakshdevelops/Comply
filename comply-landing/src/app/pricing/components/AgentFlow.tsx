"use client";

import { motion } from "motion/react";
import {
  GitBranch,
  ScanSearch,
  Brain,
  Scale,
  Wrench,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";

interface FlowStep {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  cost: string;
  runtime: string;
  tokens: string;
}

const steps: FlowStep[] = [
  {
    icon: GitBranch,
    label: "GitHub Repo",
    cost: "—",
    runtime: "—",
    tokens: "—",
  },
  {
    icon: ScanSearch,
    label: "Auditor",
    cost: "€0.10",
    runtime: "~4s",
    tokens: "2,100",
  },
  {
    icon: Brain,
    label: "Strategist",
    cost: "€0.03",
    runtime: "~6s",
    tokens: "4,230",
  },
  {
    icon: Scale,
    label: "Legal Advisor",
    cost: "€0.02",
    runtime: "~3s",
    tokens: "1,800",
  },
  {
    icon: Wrench,
    label: "Fix Generator",
    cost: "€0.50",
    runtime: "~8s",
    tokens: "5,400",
  },
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    cost: "—",
    runtime: "—",
    tokens: "—",
  },
];

export default function AgentFlow() {
  return (
    <section className="py-24 relative">
      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-warm-brown-500">
            Execution Flow
          </p>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-warm-grey-900 sm:text-3xl">
            What you&apos;re <span className="accent-text">paying for</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-warm-grey-600">
            Each compliance run orchestrates a multi-agent pipeline. Here&apos;s
            a transparent breakdown of a single execution.
          </p>
        </motion.div>

        {/* Desktop: horizontal flow */}
        <div className="hidden lg:flex items-start justify-center gap-0">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-start">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex flex-col items-center w-36"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-warm-grey-200 bg-warm-grey-50 text-warm-brown-600 shadow-sm">
                  <step.icon className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-warm-grey-900 text-center">
                  {step.label}
                </p>
                {step.cost !== "—" && (
                  <div className="mt-2 space-y-0.5 text-center">
                    <p className="font-mono text-xs text-warm-brown-600">
                      {step.cost}
                    </p>
                    <p className="text-xs text-warm-grey-400">{step.runtime}</p>
                    <p className="text-xs text-warm-grey-400">
                      {step.tokens} tokens
                    </p>
                  </div>
                )}
              </motion.div>
              {i < steps.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 + 0.2 }}
                  className="flex items-center pt-4 px-1"
                >
                  <ArrowRight className="h-4 w-4 text-warm-grey-300" />
                </motion.div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: vertical flow */}
        <div className="flex flex-col gap-4 lg:hidden">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="flex items-center gap-4 rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-4"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warm-brown-100/40 text-warm-brown-600">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-warm-grey-900">
                  {step.label}
                </p>
                {step.cost !== "—" && (
                  <p className="text-xs text-warm-grey-500">
                    {step.cost} · {step.runtime} · {step.tokens} tokens
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
