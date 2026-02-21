"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import GoogleButton from "@/components/auth/GoogleButton";
import { useAuth } from "@/contexts/AuthContext";

export default function SignUpPage() {
  const { signInWithGoogle, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Redirect if already signed in
  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  const handleGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch {
      setError("Sign up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
        isLoading={isLoading}
      />

      {error && (
        <p className="mt-3 text-center text-sm text-red-500">{error}</p>
      )}
    </AuthCard>
  );
}
