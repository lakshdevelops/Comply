"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";
import { createSubscription, getStripeConfig, confirmSubscription } from "@/lib/api";

// ── Stripe promise (loaded once) ────────────────────────────────────

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    stripePromise = getStripeConfig().then((cfg) =>
      loadStripe(cfg.publishable_key)
    );
  }
  return stripePromise;
}

// ── Inner payment form (inside Elements provider) ───────────────────

function CheckoutForm({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard?subscription=success`,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Payment failed. Please try again.");
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-warm-grey-300 bg-warm-grey-100 px-4 py-2.5 text-sm font-medium text-warm-grey-900 hover:bg-warm-grey-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-warm-brown-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-warm-brown-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            "Subscribe"
          )}
        </button>
      </div>
    </form>
  );
}

// ── Modal wrapper ───────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
};

const PLAN_PRICES: Record<string, Record<string, number>> = {
  starter: { monthly: 29, annual: 278 },
  pro: { monthly: 149, annual: 1430 },
};

interface StripeCheckoutModalProps {
  open: boolean;
  plan: "starter" | "pro";
  interval: "monthly" | "annual";
  onClose: () => void;
}

export default function StripeCheckoutModal({
  open,
  plan,
  interval,
  onClose,
}: StripeCheckoutModalProps) {
  const { user, getIdToken } = useAuth();
  const { refreshSubscription } = usePlan();
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initCheckout = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");
      const result = await createSubscription(token, plan, interval);
      setClientSecret(result.client_secret);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to initialize checkout";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken, plan, interval]);

  useEffect(() => {
    if (open && !clientSecret && !success) {
      initCheckout();
    }
  }, [open, clientSecret, success, initCheckout]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setSuccess(false);
      setError(null);
    }
  }, [open]);

  // ── Post-payment activation (runs in the PARENT, safe from unmount) ──
  useEffect(() => {
    if (!success) return;
    let cancelled = false;

    (async () => {
      try {
        // Tell the backend to check Stripe directly and update Firestore
        const token = await getIdToken();
        if (token && !cancelled) {
          await confirmSubscription(token);
        }
        // Refresh PlanContext so PlanGuard lets us through
        if (!cancelled) {
          const latest = await refreshSubscription();
          if (latest !== "free") {
            // Plan is confirmed — navigate (client-side, preserves auth state)
            router.push("/dashboard");
            return;
          }
        }
      } catch {
        // confirm call failed — fall through to polling
      }

      // Fallback: poll a few times in case webhook hasn't arrived yet
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        const latest = await refreshSubscription();
        if (latest !== "free") {
          router.push("/dashboard");
          return;
        }
      }

      // Last resort — navigate with query param so PlanGuard can retry
      if (!cancelled) {
        router.push("/dashboard?subscription=success");
      }
    })();

    return () => { cancelled = true; };
  }, [success, getIdToken, refreshSubscription, router]);

  const price = PLAN_PRICES[plan]?.[interval] ?? 0;
  const monthlyDisplay = interval === "annual" ? Math.round(price / 12) : price;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-warm-grey-900/40 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl border border-warm-grey-200 bg-warm-white p-7 shadow-xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-warm-grey-400 hover:text-warm-grey-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Plan summary */}
            <div className="mb-6">
              <h3 className="font-display text-xl font-bold text-warm-grey-900">
                Subscribe to {PLAN_LABELS[plan]}
              </h3>
              <p className="mt-1 text-sm text-warm-grey-500">
                €{monthlyDisplay}/mo
                {interval === "annual" && (
                  <span className="text-warm-grey-400">
                    {" "}
                    · €{price} billed annually
                  </span>
                )}
              </p>
            </div>

            {/* States */}
            {success ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <h4 className="font-display text-lg font-bold text-warm-grey-900">
                  Subscription active!
                </h4>
                <p className="text-sm text-warm-grey-600">
                  Redirecting to your dashboard…
                </p>
              </div>
            ) : loading && !clientSecret ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-warm-brown-500" />
                <p className="text-sm text-warm-grey-500">
                  Preparing checkout…
                </p>
              </div>
            ) : error ? (
              <div className="space-y-4">
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
                <button
                  onClick={initCheckout}
                  className="w-full rounded-xl border border-warm-grey-300 bg-warm-grey-100 px-4 py-2.5 text-sm font-medium text-warm-grey-900 hover:bg-warm-grey-200 transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : clientSecret ? (
              <Elements
                stripe={getStripePromise()}
                options={{
                  clientSecret,
                  fonts: [
                    {
                      cssSrc:
                        "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap",
                    },
                  ],
                  appearance: {
                    theme: "flat",
                    variables: {
                      colorPrimary: "#B8845C",
                      borderRadius: "12px",
                      fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
                      fontSizeBase: "14px",
                      colorText: "#1c1917",
                      colorTextSecondary: "#78716c",
                      colorBackground: "#f5f4f0",
                      colorDanger: "#dc2626",
                    },
                    rules: {
                      ".Input": {
                        backgroundColor: "#ffffff",
                        border: "1px solid #e7e5e4",
                        boxShadow: "none",
                        padding: "10px 14px",
                      },
                      ".Input:focus": {
                        border: "1px solid #B8845C",
                        boxShadow: "0 0 0 2px rgba(184,132,92,0.15)",
                        outline: "none",
                      },
                      ".Label": {
                        fontWeight: "500",
                        marginBottom: "6px",
                      },
                    },
                  },
                }}
              >
                <CheckoutForm
                  onSuccess={() => setSuccess(true)}
                  onClose={onClose}
                />
              </Elements>
            ) : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
