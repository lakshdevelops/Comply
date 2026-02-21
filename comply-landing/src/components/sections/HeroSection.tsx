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
      className="w-full max-w-lg rounded-2xl border border-dust-grey-300/60 bg-dust-grey-100 shadow-2xl shadow-dust-grey-50/80 overflow-hidden"
      style={{ transform: "perspective(1000px) rotateY(-6deg) rotateX(3deg)" }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-dust-grey-200 bg-dust-grey-50/80 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-500/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <span className="h-3 w-3 rounded-full bg-green-500/70" />
        <div className="ml-3 flex-1 rounded-md bg-dust-grey-200/70 px-3 py-1">
          <span className="text-xs text-dry-sage-500 font-mono">comply.dev/dashboard</span>
        </div>
      </div>

      {/* Dashboard body */}
      <div className="p-4 space-y-4">
        {/* KPI cards row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Compliance", value: "94%", sub: "Score", color: "text-hunter-green-600" },
            { label: "Open Issues", value: "7", sub: "Active", color: "text-fern-600" },
            { label: "PRs Generated", value: "23", sub: "This month", color: "text-dry-sage-600" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-dust-grey-200 bg-dust-grey-50/60 p-3 space-y-1"
            >
              <p className="text-xs text-dry-sage-500">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-dust-grey-400">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Agent chat panel */}
        <div className="rounded-xl border border-dust-grey-200 bg-dust-grey-50/40 p-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-1.5 w-1.5 rounded-full bg-hunter-green-600 animate-pulse" />
            <span className="text-xs font-medium text-hunter-green-700">Agent Workspace</span>
          </div>

          {/* Auditor message */}
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dust-grey-300 text-xs font-bold text-fern-800">
              A
            </div>
            <div className="flex-1 rounded-lg rounded-tl-none bg-dust-grey-200/80 px-3 py-2">
              <p className="text-xs font-semibold text-fern-700 mb-0.5">Auditor</p>
              <p className="text-xs text-dry-sage-700">Found 7 non-compliant resources in <span className="text-hunter-green-700 font-mono">infra/terraform</span></p>
            </div>
          </div>

          {/* Strategist message */}
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hunter-green-300 text-xs font-bold text-hunter-green-900">
              S
            </div>
            <div className="flex-1 rounded-lg rounded-tl-none bg-dust-grey-200/80 px-3 py-2">
              <p className="text-xs font-semibold text-hunter-green-700 mb-0.5">Strategist</p>
              <p className="text-xs text-dry-sage-700">Prioritised 3 critical fixes. Ready to generate PR.</p>
            </div>
          </div>

          {/* Legal Advisor message with cursor */}
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dry-sage-300 text-xs font-bold text-dry-sage-900">
              L
            </div>
            <div className="flex-1 rounded-lg rounded-tl-none bg-dust-grey-200/80 px-3 py-2">
              <p className="text-xs font-semibold text-dry-sage-700 mb-0.5">Legal Advisor</p>
              <p className="text-xs text-dry-sage-600">
                Checking SOC 2 alignment
                <span className="inline-block ml-0.5 h-3 w-0.5 bg-fern-600 animate-pulse" />
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
    <section className="relative min-h-screen pt-24 pb-20 flex items-center overflow-hidden dot-grid">
      {/* Atmospheric gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-hunter-green-100/30 blur-3xl" />
        <div className="absolute top-1/3 -right-48 h-[500px] w-[500px] rounded-full bg-dry-sage-100/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-dust-grey-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 w-full">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          {/* Left: text */}
          <div className="flex flex-col gap-6 max-w-xl">
            <motion.div {...fadeUp(0)}>
              <Badge>
                <Zap className="h-3 w-3" />
                Multi-Agent AI · GitHub Native
              </Badge>
            </motion.div>

            <motion.h1
              {...fadeUp(0.1)}
              className="font-display italic text-5xl font-extrabold leading-[1.1] tracking-tight text-dust-grey-950 sm:text-6xl"
            >
              Autonomous Compliance.{" "}
              <span className="gradient-text">Faster, Smarter, Safer.</span>
            </motion.h1>

            <motion.p
              {...fadeUp(0.2)}
              className="text-lg leading-relaxed text-dry-sage-700"
            >
              Connect your GitHub repo and a team of AI agents audits, plans,
              and fixes your infrastructure automatically — in minutes, not
              months.
            </motion.p>

            <motion.div {...fadeUp(0.3)} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-fern-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-fern-800 active:scale-95 transition-all duration-200"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-dry-sage-600 hover:text-fern-800 transition-colors"
              >
                See how it works
              </a>
            </motion.div>

            {/* Social trust row */}
            <motion.div
              {...fadeUp(0.4)}
              className="flex items-center gap-4 pt-2"
            >
              {["SOC 2", "ISO 27001", "CIS Benchmarks", "GDPR"].map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-dust-grey-400 font-mono"
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
