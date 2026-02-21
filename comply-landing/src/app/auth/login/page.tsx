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
import { signInSchema } from "@/lib/validations";

type FieldErrors = { email?: string; password?: string; server?: string };

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
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

    const result = signInSchema.safeParse(form);
    if (!result.success) {
      const fieldErrs: FieldErrors = {};
      result.error.issues.forEach((err: import("zod").ZodIssue) => {
        const key = err.path[0] as keyof FieldErrors;
        if (!fieldErrs[key]) fieldErrs[key] = err.message;
      });
      setErrors(fieldErrs);
      return;
    }

    setIsLoading(true);
    try {
      const res = await signIn("credentials", {
        email: result.data.email,
        password: result.data.password,
        redirect: false,
      });

      if (!res || res.error) {
        setErrors({ server: "Incorrect email or password. Please try again." });
        return;
      }

      // If 2FA is required, redirect to OTP verification
      // (The auth callback sets requiresOtp — check session or handle via redirect)
      router.push(`/auth/verify?email=${encodeURIComponent(result.data.email)}`);
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
          <h1 className="font-display italic text-2xl font-bold text-dust-grey-950">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-dry-sage-600">
            Sign in to continue to Comply
          </p>
        </div>
      </div>

      {/* Google OAuth */}
      <GoogleButton
        label="Sign in with Google"
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
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
        </div>

        {/* Password */}
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
        />

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
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Bottom nav */}
      <p className="mt-5 text-center text-sm text-dry-sage-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/signup"
          className="font-medium text-fern-700 hover:text-fern-900 underline-offset-2 hover:underline transition-colors"
        >
          Sign up instead
        </Link>
      </p>
    </AuthCard>
  );
}
