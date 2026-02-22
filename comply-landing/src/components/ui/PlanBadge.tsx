"use client";

import { usePlan } from "@/contexts/PlanContext";

const PLAN_STYLES: Record<string, string> = {
  starter:
    "border-warm-brown-300/50 bg-warm-brown-100/40 text-warm-brown-700",
  pro:
    "border-amber-400/50 bg-amber-100/40 text-amber-800",
  enterprise:
    "border-violet-400/50 bg-violet-100/40 text-violet-800",
};

/**
 * Small pill badge showing the user's current plan name.
 * Returns null for free-tier users.
 */
export default function PlanBadge() {
  const { plan, loading } = usePlan();

  if (loading || plan === "free") return null;

  const style = PLAN_STYLES[plan] ?? PLAN_STYLES.starter;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none ${style}`}
    >
      {plan}
    </span>
  );
}
