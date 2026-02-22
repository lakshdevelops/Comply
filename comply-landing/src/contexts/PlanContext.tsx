"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSubscription } from "@/lib/api";

interface PlanFeatures {
  continuous_scanning: boolean;
  auto_pr: boolean;
  legal_agent: boolean;
  audit_logging: boolean;
  sso: boolean;
  max_repos: number;
  max_agent_runs: number;
}

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string | null;
  billing_interval: string | null;
  features: PlanFeatures;
}

interface PlanContextType {
  subscription: Subscription | null;
  loading: boolean;
  plan: string;
  features: PlanFeatures;
  hasFeature: (name: keyof PlanFeatures) => boolean;
  /** Re-fetches subscription from API. Returns the plan string. */
  refreshSubscription: () => Promise<string>;
}

const FREE_FEATURES: PlanFeatures = {
  continuous_scanning: false,
  auto_pr: false,
  legal_agent: false,
  audit_logging: false,
  sso: false,
  max_repos: 1,
  max_agent_runs: 50,
};

const PlanContext = createContext<PlanContextType | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, getIdToken, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async (): Promise<string> => {
    if (!user) {
      setSubscription(null);
      // Only mark loading=false if auth is done loading —
      // otherwise we'd prematurely report "free" before we know who the user is.
      if (!authLoading) setLoading(false);
      return "free";
    }
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return "free";
      const data = await getSubscription(token);
      setSubscription(data);
      return data?.plan ?? "free";
    } catch {
      setSubscription(null);
      return "free";
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken, authLoading]);

  useEffect(() => {
    // Don't attempt to fetch until Firebase Auth has finished initialising
    if (authLoading) return;
    fetchSubscription();
  }, [authLoading, fetchSubscription]);

  const plan = subscription?.plan ?? "free";
  const features = subscription?.features ?? FREE_FEATURES;

  const hasFeature = useCallback(
    (name: keyof PlanFeatures): boolean => {
      const val = features[name];
      if (typeof val === "boolean") return val;
      // For numeric limits, return true if limit is not zero
      return val !== 0;
    },
    [features]
  );

  return (
    <PlanContext.Provider
      value={{
        subscription,
        loading,
        plan,
        features,
        hasFeature,
        refreshSubscription: fetchSubscription,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within <PlanProvider>");
  return ctx;
}
