"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import GoogleButton from "@/components/auth/GoogleButton";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { signInWithGoogle, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const getRedirectUrl = () => {
    const redirect = searchParams.get("redirect");
    if (!redirect) return "/dashboard";
    const extra = new URLSearchParams();
    for (const [key, val] of searchParams.entries()) {
      if (key !== "redirect") extra.set(key, val);
    }
    const qs = extra.toString();
    return qs ? `${redirect}?${qs}` : redirect;
  };

  // Redirect if already signed in
  useEffect(() => {
    if (user) router.push(getRedirectUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.push(getRedirectUrl());
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user") {
        setError(null); // user cancelled, no error needed
      } else if (code === "auth/popup-blocked") {
        setError("Popup was blocked. Please allow popups for this site.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This domain is not authorised for sign-in. Check Firebase console.");
      } else {
        setError("Sign in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard>
      {/* Logo mark */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warm-brown-100/60 border border-warm-brown-300/40">
          <span className="font-display text-lg font-bold text-warm-brown-700">C</span>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-warm-grey-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-warm-grey-600">
            Sign in to continue to Comply
          </p>
        </div>
      </div>

      {/* Google OAuth */}
      <GoogleButton
        label="Sign in with Google"
        onClick={handleGoogle}
        isLoading={isLoading}
      />

      {error && (
        <p className="mt-3 text-center text-sm text-red-500">{error}</p>
      )}

      <p className="mt-5 text-center text-sm text-warm-grey-500">
        Don&apos;t have an account?{" "}
        <a
          href={`/auth/signup${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
          className="font-medium text-warm-brown-600 hover:text-warm-brown-700 transition-colors"
        >
          Create one
        </a>
      </p>
    </AuthCard>
  );
}
