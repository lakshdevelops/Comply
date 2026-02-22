"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import FooterSection from "@/components/sections/FooterSection";
import PricingHero from "./components/PricingHero";
import PricingPlans from "./components/PricingPlans";
import StripeCheckoutModal from "./components/StripeCheckoutModal";
import EnterpriseModal from "./components/EnterpriseModal";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/contexts/PlanContext";

export default function PricingPage() {
  const { user } = useAuth();
  const { plan: currentPlan } = usePlan();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Stripe checkout modal state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro">("pro");
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "annual">("monthly");

  // Enterprise modal state
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);

  // Auto-open checkout modal when returning from auth with ?plan=...&interval=...
  useEffect(() => {
    if (!user) return;
    const plan = searchParams.get("plan") as "starter" | "pro" | null;
    const interval = (searchParams.get("interval") ?? "monthly") as "monthly" | "annual";
    if (plan === "starter" || plan === "pro") {
      setSelectedPlan(plan);
      setSelectedInterval(interval);
      setCheckoutOpen(true);
      // Clean up query params without re-render
      router.replace("/pricing", { scroll: false });
    }
  }, [user, searchParams, router]);

  const handleSelectPlan = (
    plan: "starter" | "pro",
    interval: "monthly" | "annual"
  ) => {
    if (!user) {
      router.push(`/auth/signup?redirect=/pricing&plan=${plan}&interval=${interval}&showLogin=1`);
      return;
    }
    setSelectedPlan(plan);
    setSelectedInterval(interval);
    setCheckoutOpen(true);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-warm-white">
      <Navbar />
      <PricingHero />
      <PricingPlans
        currentPlan={currentPlan}
        onSelectPlan={handleSelectPlan}
        onEnterprise={() => setEnterpriseOpen(true)}
      />
      <FooterSection />

      {/* Modals */}
      <StripeCheckoutModal
        open={checkoutOpen}
        plan={selectedPlan}
        interval={selectedInterval}
        onClose={() => setCheckoutOpen(false)}
      />
      <EnterpriseModal
        open={enterpriseOpen}
        onClose={() => setEnterpriseOpen(false)}
      />
    </main>
  );
}
