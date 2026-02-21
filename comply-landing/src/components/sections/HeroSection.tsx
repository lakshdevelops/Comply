"use client";

import { motion, type Transition } from "motion/react";
import { ArrowRight, Zap } from "lucide-react";
import Badge from "@/components/ui/Badge";

const transition = (delay: number): Transition => ({
  duration: 0.6,
  delay,
  ease: "easeOut",
});

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: transition(delay),
});

function DashboardMockup() {
  return (
    <div
      className="w-full max-w-xl rounded-2xl border border-warm-grey-300 bg-warm-grey-100 shadow-2xl shadow-warm-grey-100/80 overflow-hidden"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-warm-grey-200 bg-warm-grey-50/80 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-500/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <span className="h-3 w-3 rounded-full bg-green-500/70" />
        <div className="ml-3 flex-1 rounded-md bg-warm-grey-200/70 px-3 py-1">
          <span className="text-xs text-warm-grey-500 font-mono">comply.dev/dashboard</span>
        </div>
      </div>

      {/* Dashboard body */}
      <div className="p-4 space-y-4">
        {/* KPI cards row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Compliance", value: "94%", sub: "Score", color: "text-warm-brown-600" },
            { label: "Open Issues", value: "7", sub: "Active", color: "text-warm-brown-500" },
            { label: "PRs Generated", value: "23", sub: "This month", color: "text-warm-grey-600" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-warm-grey-200 bg-warm-grey-50/60 p-3 space-y-1"
            >
              <p className="text-xs text-warm-grey-500">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-warm-grey-400">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Agent chat panel */}
        <div className="rounded-xl border border-warm-grey-200 bg-warm-grey-50/40 p-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-1.5 w-1.5 rounded-full bg-warm-brown-500" />
            <span className="text-xs font-medium text-warm-brown-600">Agent Workspace</span>
          </div>

          {/* Auditor message */}
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warm-grey-300 text-xs font-bold text-warm-brown-700">
              A
            </div>
            <div className="flex-1 rounded-lg rounded-tl-none bg-warm-grey-200/80 px-3 py-2">
              <p className="text-xs font-semibold text-warm-brown-600 mb-0.5">Auditor</p>
              <p className="text-xs text-warm-grey-700">Found 7 non-compliant resources in <span className="text-warm-brown-600 font-mono">infra/terraform</span></p>
            </div>
          </div>

          {/* Strategist message */}
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warm-brown-300 text-xs font-bold text-warm-brown-900">
              S
            </div>
            <div className="flex-1 rounded-lg rounded-tl-none bg-warm-grey-200/80 px-3 py-2">
              <p className="text-xs font-semibold text-warm-brown-600 mb-0.5">Strategist</p>
              <p className="text-xs text-warm-grey-700">Prioritised 3 critical fixes. Ready to generate PR.</p>
            </div>
          </div>

          {/* Legal Advisor message with cursor */}
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warm-brown-200 text-xs font-bold text-warm-grey-900">
              L
            </div>
            <div className="flex-1 rounded-lg rounded-tl-none bg-warm-grey-200/80 px-3 py-2">
              <p className="text-xs font-semibold text-warm-grey-700 mb-0.5">Legal Advisor</p>
              <p className="text-xs text-warm-grey-600">
                Checking SOC 2 alignment
                <span className="inline-block ml-0.5 h-3 w-0.5 bg-warm-brown-500 animate-pulse" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative min-h-screen pt-24 pb-20 flex items-center overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-6 w-full">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          {/* Left: text */}
          <div className="flex flex-col gap-5 max-w-xl">
            <motion.div {...fadeUp(0)}>
              <span className="font-display text-5xl font-semibold tracking-tight text-warm-grey-900 sm:text-6xl">
                Comply
              </span>
            </motion.div>

            <motion.div {...fadeUp(0.05)}>
              <Badge>
                <Zap className="h-3 w-3" />
                Multi-Agent AI · GitHub Native
              </Badge>
            </motion.div>

            <motion.h1
              {...fadeUp(0.1)}
              className="font-display italic text-3xl font-bold leading-[1.15] tracking-tight text-warm-grey-900 sm:text-4xl"
            >
              Autonomous Compliance.{" "}
              <span className="accent-text">Faster, Smarter, Safer.</span>
            </motion.h1>

            <motion.p
              {...fadeUp(0.15)}
              className="text-lg leading-relaxed text-warm-grey-600"
            >
              Connect your GitHub repo and a team of AI agents audits, plans,
              and fixes your infrastructure automatically — in minutes, not
              months.
            </motion.p>

            <motion.div {...fadeUp(0.2)} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-warm-brown-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-warm-brown-600 active:scale-95 transition-all duration-200"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-warm-grey-500 hover:text-warm-grey-900 transition-colors"
              >
                See how it works
              </a>
            </motion.div>

            {/* Social trust row */}
            <motion.div
              {...fadeUp(0.25)}
              className="flex items-center gap-4 pt-2"
            >
              {["SOC 2", "ISO 27001", "CIS Benchmarks", "GDPR"].map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-warm-grey-400 font-mono"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right: dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="hidden lg:flex justify-center"
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
