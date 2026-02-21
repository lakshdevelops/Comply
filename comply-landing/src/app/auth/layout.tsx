import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Comply — Authentication",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col bg-dust-grey-50">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(162,195,168,0.15),transparent)]" />
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-hunter-green-100/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-pine-teal-100/20 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hunter-green-300 group-hover:bg-hunter-green-400 transition-colors">
            <ShieldCheck className="h-4 w-4 text-hunter-green-900" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-fern-800">
            Comply
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm text-dry-sage-600 hover:text-fern-800 transition-colors"
        >
          ← Back to home
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center">
        <p className="text-xs text-dust-grey-400">
          &copy; {new Date().getFullYear()} Comply. Secure by design.
        </p>
      </footer>
    </div>
  );
}
