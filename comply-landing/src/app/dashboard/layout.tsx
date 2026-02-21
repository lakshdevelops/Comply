"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-warm-white">
        <TopNav />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}

function TopNav() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-warm-grey-200 bg-warm-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="font-display text-xl font-semibold text-warm-grey-900">
          Comply
        </Link>

        {/* User info + sign out */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="h-8 w-8 rounded-full border border-warm-grey-200"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warm-grey-200">
                <User className="h-4 w-4 text-warm-grey-600" />
              </div>
            )}
            <span className="hidden text-sm font-medium text-warm-grey-800 sm:block">
              {user?.displayName || user?.email || "User"}
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-xl border border-warm-grey-300 bg-warm-grey-100 px-3 py-1.5 text-sm text-warm-grey-900 hover:bg-warm-grey-200 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
