"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import GoogleButton from "@/components/auth/GoogleButton";
import OrDivider from "@/components/auth/OrDivider";
import PasswordInput from "@/components/auth/PasswordInput";
import { signUpSchema, type SignUpInput } from "@/lib/validations";
import { ZodError } from "zod";

type FieldErrors = Partial<Record<keyof SignUpInput, string>>;

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors & { server?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, server: undefined }));
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const result = signUpSchema.safeParse(form);
    if (!result.success) {
      const fieldErrs: FieldErrors = {};
      result.error.issues.forEach((err: import("zod").ZodIssue) => {
        const key = err.path[0] as keyof SignUpInput;
        if (!fieldErrs[key]) fieldErrs[key] = err.message;
      });
      setErrors(fieldErrs);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ email: "An account with this email already exists. Sign in instead?" });
        } else {
          setErrors({ server: data.error || "Something went wrong. Please try again." });
        }
        return;
      }

      if (data.requiresOtp) {
        router.push(`/auth/verify?email=${encodeURIComponent(result.data.email)}`);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setErrors({ server: "Network error. Please check your connection." });
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
        isLoading={isGoogleLoading}
      />

      <OrDivider />

      {/* Email + Password form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-dust-grey-800">
            Email address
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={set("email")}
            className={`w-full rounded-xl border px-4 py-3 text-sm text-dust-grey-950 placeholder-dust-grey-400 outline-none bg-white transition-all duration-150
              ${errors.email
                ? "border-red-400 ring-1 ring-red-300"
                : "border-dust-grey-300 focus:border-hunter-green-500 focus:ring-1 focus:ring-hunter-green-400"
              }`}
          />
          {errors.email && (
            <p className="text-xs text-red-500">
              {errors.email}{" "}
              {errors.email.includes("already exists") && (
                <Link href="/auth/login" className="underline hover:text-red-700">
                  Sign in
                </Link>
              )}
            </p>
          )}
        </div>

        {/* Password */}
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          placeholder="Min. 10 chars, uppercase, number, symbol"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
        />

        {/* Confirm password */}
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
          error={errors.confirmPassword}
        />

        {/* Password strength hints */}
        <PasswordHints password={form.password} />

        {/* Server error */}
        {errors.server && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {errors.server}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 w-full rounded-xl bg-fern-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-fern-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-hunter-green-500 focus-visible:ring-offset-2"
        >
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>

      {/* Bottom nav */}
      <p className="mt-5 text-center text-sm text-dry-sage-600">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-fern-700 hover:text-fern-900 underline-offset-2 hover:underline transition-colors"
        >
          Sign in instead
        </Link>
      </p>
    </AuthCard>
  );
}

/** Password strength visual hints */
function PasswordHints({ password }: { password: string }) {
  if (!password) return null;

  const rules = [
    { label: "10+ characters", pass: password.length >= 10 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Special character", pass: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {rules.map((r) => (
        <span
          key={r.label}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            r.pass
              ? "bg-hunter-green-100 text-hunter-green-700"
              : "bg-dust-grey-100 text-dust-grey-500"
          }`}
        >
          {r.pass ? "✓" : "·"} {r.label}
        </span>
      ))}
    </div>
  );
}
