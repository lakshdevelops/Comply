"use client";

import { motion, type Transition } from "motion/react";
import { ArrowDown } from "lucide-react";

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

export default function PricingHero() {
  return (
    <section className="relative pt-32 pb-4 flex items-center overflow-hidden">
      <div className="relative mx-auto max-w-4xl px-6 w-full text-center">
        <motion.p
          {...fadeUp(0)}
          className="mb-3 text-sm font-semibold uppercase tracking-widest text-warm-brown-500"
        >
          Pricing
        </motion.p>
        <motion.h1
          {...fadeUp(0.05)}
          className="font-display text-3xl font-extrabold tracking-tight text-warm-grey-900 sm:text-5xl"
        >
          Pricing built for{" "}
          <span className="accent-text">autonomous AI agents.</span>
        </motion.h1>
        <motion.p
          {...fadeUp(0.1)}
          className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-warm-grey-600"
        >
          Transparent, predictable plans for teams of every size.
        </motion.p>
        <motion.div {...fadeUp(0.15)} className="mt-8">
          <a
            href="#plans"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-warm-brown-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-warm-brown-600 active:scale-95 transition-all duration-200"
          >
            View Plans <ArrowDown className="h-4 w-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
