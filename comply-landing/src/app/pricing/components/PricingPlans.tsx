"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X, Sparkles } from "lucide-react";

// ── Plan data ───────────────────────────────────────────────────────

interface PlanFeature {
  label: string;
  starter: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

const features: PlanFeature[] = [
  { label: "Repositories", starter: "1", pro: "10", enterprise: "Unlimited" },
  { label: "Agent runs / mo", starter: "500", pro: "5,000", enterprise: "Unlimited" },
  { label: "Continuous scans", starter: false, pro: true, enterprise: true },
  { label: "Auto PRs", starter: false, pro: true, enterprise: true },
  { label: "Legal advisor", starter: false, pro: false, enterprise: true },
  { label: "Compliance dashboard", starter: "Basic", pro: "Advanced", enterprise: "Full" },
  { label: "Audit logs", starter: false, pro: true, enterprise: true },
  { label: "SSO", starter: false, pro: false, enterprise: true },
];

interface Plan {
  name: string;
  key: "starter" | "pro" | "enterprise";
  monthlyPrice: number | null;
  annualPrice: number | null;
  cta: string;
  highlighted: boolean;
}

const plans: Plan[] = [
  {
    name: "Starter",
    key: "starter",
    monthlyPrice: 29,
    annualPrice: 278,
    cta: "Subscribe",
    highlighted: false,
  },
  {
    name: "Pro",
    key: "pro",
    monthlyPrice: 149,
    annualPrice: 1430,
    cta: "Subscribe",
    highlighted: true,
  },
  {
    name: "Enterprise",
    key: "enterprise",
    monthlyPrice: null,
    annualPrice: null,
    cta: "Request Access",
    highlighted: false,
  },
];

// ── Plan hierarchy ──────────────────────────────────────────────────

const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

// ── Props ───────────────────────────────────────────────────────────

interface PricingPlansProps {
  currentPlan?: string;
  onSelectPlan: (plan: "starter" | "pro", interval: "monthly" | "annual") => void;
  onEnterprise: () => void;
}

// ── Component ───────────────────────────────────────────────────────

export default function PricingPlans({ currentPlan = "free", onSelectPlan, onEnterprise }: PricingPlansProps) {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="plans" className="py-12 relative">
      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-warm-grey-900 sm:text-3xl">
            Choose your <span className="accent-text">plan</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-warm-grey-600">
            Simple, predictable pricing for every team.
          </p>
        </motion.div>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="flex w-32 items-center justify-end">
            <span
              className={`text-sm font-medium transition-colors ${
                !annual ? "text-warm-grey-900" : "text-warm-grey-400"
              }`}
            >
              Monthly
            </span>
          </div>
          <button
            onClick={() => setAnnual((v) => !v)}
            className="relative h-7 w-12 rounded-full bg-warm-grey-200 transition-colors hover:bg-warm-grey-300"
            aria-label="Toggle billing interval"
          >
            <motion.div
              className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-warm-brown-500 shadow-sm"
              animate={{ x: annual ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <div className="flex w-32 items-center gap-1.5">
            <span
              className={`text-sm font-medium transition-colors ${
                annual ? "text-warm-grey-900" : "text-warm-grey-400"
              }`}
            >
              Annual
            </span>
            <AnimatePresence>
              {annual && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="rounded-full bg-warm-brown-100/60 px-2.5 py-0.5 text-xs font-semibold text-warm-brown-700"
                >
                  ~20% off
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan, i) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            const isEnterprise = plan.key === "enterprise";

            const currentRank = PLAN_RANK[currentPlan] ?? 0;
            const cardRank = PLAN_RANK[plan.key] ?? 0;
            const isCurrent = plan.key === currentPlan;
            const isDowngrade = cardRank < currentRank;
            const isUpgrade = cardRank > currentRank;

            // Determine CTA label
            let ctaLabel = plan.cta;
            if (isCurrent) ctaLabel = "Current Plan";
            else if (isDowngrade) ctaLabel = "Current Plan Includes This";
            else if (isUpgrade && !isEnterprise) ctaLabel = "Upgrade";

            const ctaDisabled = isCurrent || isDowngrade;

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.12 }}
                whileHover={{ y: -4 }}
                className={`relative flex flex-col rounded-2xl border p-7 transition-colors ${
                  isCurrent
                    ? "border-warm-brown-500 bg-warm-brown-50/40 shadow-lg shadow-warm-brown-200/50 ring-2 ring-warm-brown-400/30"
                    : plan.highlighted && !isDowngrade
                      ? "border-warm-brown-400 bg-warm-brown-50/30 shadow-lg shadow-warm-brown-100/40"
                      : "border-warm-grey-200 bg-warm-grey-50 hover:border-warm-brown-300/60"
                }`}
              >
                {/* Badge: Current Plan or Most Popular */}
                {isCurrent ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-warm-brown-600 px-3 py-1 text-xs font-semibold text-white">
                    <Check className="h-3 w-3" /> Current Plan
                  </span>
                ) : (
                  plan.highlighted && !isDowngrade && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-warm-brown-500 px-3 py-1 text-xs font-semibold text-white">
                      <Sparkles className="h-3 w-3" /> Most Popular
                    </span>
                  )
                )}

                {/* Plan name */}
                <h3 className="font-display text-lg font-bold text-warm-grey-900">
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="mt-4 mb-6">
                  {isEnterprise ? (
                    <span className="font-display text-3xl font-extrabold text-warm-grey-900">
                      Custom
                    </span>
                  ) : (
                    <>
                      <span className="font-display text-3xl font-extrabold text-warm-grey-900">
                        €{annual ? Math.round(price! / 12) : price}
                      </span>
                      <span className="text-sm text-warm-grey-500"> / mo</span>
                      {annual && (
                        <p className="mt-1 text-xs text-warm-grey-400">
                          €{price} billed annually
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Features */}
                <ul className="flex-1 space-y-3 mb-8">
                  {features.map((f) => {
                    const value = f[plan.key];
                    const enabled = value !== false;
                    return (
                      <li key={f.label} className="flex items-start gap-2 text-sm">
                        {enabled ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-warm-brown-500" />
                        ) : (
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-warm-grey-300" />
                        )}
                        <span
                          className={
                            enabled ? "text-warm-grey-700" : "text-warm-grey-400"
                          }
                        >
                          {typeof value === "string" ? `${f.label}: ${value}` : f.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* CTA */}
                <button
                  onClick={() =>
                    isEnterprise
                      ? onEnterprise()
                      : onSelectPlan(plan.key as "starter" | "pro", annual ? "annual" : "monthly")
                  }
                  disabled={ctaDisabled}
                  className={`w-full rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 ${
                    ctaDisabled
                      ? "cursor-default border border-warm-grey-200 bg-warm-grey-100 text-warm-grey-400"
                      : plan.highlighted
                        ? "bg-warm-brown-500 text-white hover:bg-warm-brown-600 shadow-sm active:scale-95"
                        : "border border-warm-grey-300 bg-warm-grey-100 text-warm-grey-900 hover:bg-warm-grey-200 active:scale-95"
                  }`}
                >
                  {ctaLabel}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
