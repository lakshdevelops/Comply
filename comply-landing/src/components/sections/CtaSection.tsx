"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

export default function CtaSection() {
  return (
    <section className="relative py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-warm-brown-50" />

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-6"
        >
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-warm-grey-900 sm:text-3xl">
            Ready to automate your{" "}
            <span className="accent-text">compliance?</span>
          </h2>

          <p className="max-w-xl text-base leading-relaxed text-warm-grey-600">
            Connect your GitHub repository and your AI compliance team starts
            working immediately. No setup, no configuration, no waiting.
          </p>

          <a
            href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-warm-brown-500 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-warm-brown-600 active:scale-95 transition-all duration-200"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </a>

          <p className="text-xs text-warm-grey-400">
            GitHub OAuth · Cancel anytime
          </p>
        </motion.div>
      </div>
    </section>
  );
}
