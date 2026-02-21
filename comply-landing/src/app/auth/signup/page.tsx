"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import GoogleButton from "@/components/auth/GoogleButton";

export default function SignUpPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <AuthCard>
      {/* Logo mark */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hunter-green-200/60 border border-hunter-green-300/40">
          <ShieldCheck className="h-6 w-6 text-hunter-green-700" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-dust-grey-950">
            Create your Comply account
          </h1>
          <p className="mt-1 text-sm text-dry-sage-600">
            Start automating regulatory compliance in minutes
          </p>
        </div>
      </div>

      {/* Google OAuth */}
      <GoogleButton
        label="Sign up with Google"
        onClick={handleGoogle}
        isLoading={isGoogleLoading}
      />
    </AuthCard>
  );
}
