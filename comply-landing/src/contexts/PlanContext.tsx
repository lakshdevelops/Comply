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
  refreshSubscription: () => Promise<void>;
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
  const { user, getIdToken } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await getSubscription(token);
      setSubscription(data);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

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
