"use client";

import { Lock, ArrowUpRight } from "lucide-react";

interface UpgradePromptProps {
  feature: string;
  plan?: string;
  className?: string;
}

export default function UpgradePrompt({
  feature,
  plan = "Pro",
  className = "",
}: UpgradePromptProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-warm-brown-200 bg-warm-brown-50/40 p-4 ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warm-brown-100/60 text-warm-brown-600">
        <Lock className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-warm-grey-900">
          {feature} requires {plan}
        </p>
        <p className="text-xs text-warm-grey-500">
          Upgrade your plan to unlock this feature.
        </p>
      </div>
      <a
        href="/pricing"
        className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-warm-brown-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-warm-brown-600 active:scale-95 transition-all duration-200"
      >
        Upgrade <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}
