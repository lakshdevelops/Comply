"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import OtpInput from "@/components/auth/OtpInput";

const OTP_EXPIRY_SECONDS = 60;

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [seconds, setSeconds] = useState(OTP_EXPIRY_SECONDS);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  // Countdown timer
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (otp.length !== 6) {
        setError("Enter the 6-digit code from your email.");
        return;
      }
      setError("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otp, email }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Invalid or expired code. Please try again.");
          setOtp("");
          return;
        }

        router.push("/dashboard");
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    },
    [otp, email, router]
  );

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (otp.length === 6) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const handleResend = async () => {
    setIsResending(true);
    setResendMessage("");
    setError("");
    // TODO: call POST /api/auth/resend-otp when backend is wired up
    await new Promise((r) => setTimeout(r, 800));
    setSeconds(OTP_EXPIRY_SECONDS);
    setResendMessage("A new code has been sent.");
    setIsResending(false);
  };

  return (
    <AuthCard>
      {/* Icon */}
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hunter-green-200/60 border border-hunter-green-300/40">
          <MailCheck className="h-6 w-6 text-hunter-green-700" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-dust-grey-950">
            Check your inbox
          </h1>
          <p className="mt-1 text-sm text-dry-sage-600">
            We sent a 6-digit code to
          </p>
          {email && (
            <p className="mt-0.5 text-sm font-semibold text-dust-grey-900 break-all">
              {email}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
        <OtpInput
          value={otp}
          onChange={setOtp}
          error={error}
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading || otp.length !== 6}
          className="w-full rounded-xl bg-fern-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-fern-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-hunter-green-500 focus-visible:ring-offset-2"
        >
          {isLoading ? "Verifying…" : "Verify code"}
        </button>

        {/* Resend / countdown */}
        <div className="text-center text-sm">
          {seconds > 0 ? (
            <p className="text-dry-sage-500">
              Resend code in{" "}
              <span className="tabular-nums font-medium text-dust-grey-700">
                0:{String(seconds).padStart(2, "0")}
              </span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-medium text-fern-700 hover:text-fern-900 underline-offset-2 hover:underline transition-colors disabled:opacity-60"
            >
              {isResending ? "Sending…" : "Resend code"}
            </button>
          )}
          {resendMessage && (
            <p className="mt-1 text-xs text-hunter-green-600">{resendMessage}</p>
          )}
        </div>
      </form>

      {/* Bottom nav */}
      <p className="mt-6 text-center text-sm text-dry-sage-600">
        Wrong email?{" "}
        <Link
          href="/auth/signup"
          className="font-medium text-fern-700 hover:text-fern-900 underline-offset-2 hover:underline transition-colors"
        >
          Start over
        </Link>
      </p>
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
