import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Comply — Authentication",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col bg-warm-white">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(184,132,92,0.10),transparent)]" />
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-warm-brown-100/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-warm-brown-100/20 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        <Link href="/" className="font-display text-xl font-semibold text-warm-grey-900">
          Comply
        </Link>
        <Link
          href="/"
          className="text-sm text-warm-grey-600 hover:text-warm-grey-900 transition-colors"
        >
          &larr; Back to home
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center">
        <p className="text-xs text-warm-grey-400">
          &copy; {new Date().getFullYear()} Comply. Secure by design.
        </p>
      </footer>
    </div>
  );
}
