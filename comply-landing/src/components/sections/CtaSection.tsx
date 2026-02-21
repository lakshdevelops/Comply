"use client";

import { motion } from "motion/react";
import { ShieldCheck, ArrowRight } from "lucide-react";

export default function CtaSection() {
  return (
    <section className="relative py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-dust-grey-100 via-pine-teal-50 to-dry-sage-50" />

      {/* Subtle grid lines */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(163,172,134,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(163,172,134,0.15) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/4 h-80 w-80 rounded-full bg-hunter-green-100/40 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 h-80 w-80 rounded-full bg-dust-grey-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          {/* Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-hunter-green-200/50 border border-hunter-green-300/40">
            <ShieldCheck className="h-8 w-8 text-hunter-green-700" />
          </div>

          <h2 className="font-display text-4xl font-extrabold tracking-tight text-dust-grey-950 sm:text-5xl">
            Ready to automate your{" "}
            <span className="gradient-text">compliance?</span>
          </h2>

          <p className="max-w-xl text-lg leading-relaxed text-dry-sage-700">
            Connect your GitHub repository and your AI compliance team starts
            working immediately. No setup, no configuration, no waiting.
          </p>

          <a
            href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-fern-700 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-fern-800 active:scale-95 transition-all duration-200"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </a>

          <p className="text-xs text-dust-grey-400">
            No credit card required · GitHub OAuth · Cancel anytime
          </p>
        </motion.div>
      </div>
    </section>
  );
}
