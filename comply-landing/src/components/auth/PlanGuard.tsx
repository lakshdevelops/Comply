"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { useAuth } from "@/contexts/AuthContext";
import { confirmSubscription } from "@/lib/api";

/**
 * Redirects users on the free plan to the pricing page.
 * If `?subscription=success` is present (post-checkout redirect from Stripe),
 * calls the confirm endpoint to sync Stripe → Firestore, then refreshes the
 * plan context before deciding whether to let the user through.
 */
export default function PlanGuard({ children }: { children: React.ReactNode }) {
  const { plan, loading, refreshSubscription } = usePlan();
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [confirming, setConfirming] = useState(false);

  const justSubscribed = searchParams.get("subscription") === "success";

  useEffect(() => {
    // Wait for both auth AND plan context to finish loading
    if (loading || authLoading) return;

    // Already paid → let through
    if (plan !== "free") return;

    // Just came from Stripe checkout redirect (3D Secure etc.)
    if (justSubscribed && !confirming) {
      setConfirming(true);
      let cancelled = false;

      (async () => {
        try {
          const token = await getIdToken();
          if (token && !cancelled) {
            await confirmSubscription(token);
          }
          if (!cancelled) {
            const latest = await refreshSubscription();
            if (latest !== "free") {
              // Strip the query param and stay on dashboard
              router.replace("/dashboard", { scroll: false });
              setConfirming(false);
              return;
            }
          }
        } catch {
          // confirm failed, try polling
        }

        // Fallback: poll a few more times
        for (let i = 0; i < 8 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const latest = await refreshSubscription();
          if (latest !== "free") {
            router.replace("/dashboard", { scroll: false });
            setConfirming(false);
            return;
          }
        }

        // Give up
        if (!cancelled) {
          setConfirming(false);
          router.push("/pricing");
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    // Normal free-tier user, no recent checkout → redirect
    if (!justSubscribed && !confirming) {
      router.push("/pricing");
    }
  }, [plan, loading, authLoading, justSubscribed, confirming, refreshSubscription, getIdToken, router]);

  if (loading || authLoading || confirming) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-warm-white gap-3">
        <div className="animate-pulse text-warm-grey-400">
          {confirming ? "Activating your subscription…" : "Loading…"}
        </div>
      </div>
    );
  }

  if (plan === "free") return null;

  return <>{children}</>;
}
