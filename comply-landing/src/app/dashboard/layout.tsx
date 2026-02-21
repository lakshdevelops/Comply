"use client";

import Link from "next/link";
import { ShieldCheck, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-dust-grey-50">
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
    <header className="sticky top-0 z-50 border-b border-dust-grey-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hunter-green-300 group-hover:bg-hunter-green-400 transition-colors">
            <ShieldCheck className="h-4 w-4 text-hunter-green-900" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-fern-800">
            Comply
          </span>
        </Link>

        {/* User info + sign out */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="h-8 w-8 rounded-full border border-dust-grey-200"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dust-grey-200">
                <User className="h-4 w-4 text-dust-grey-600" />
              </div>
            )}
            <span className="hidden text-sm font-medium text-dust-grey-800 sm:block">
              {user?.displayName || user?.email || "User"}
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-xl border border-dust-grey-300 bg-white px-3 py-1.5 text-sm text-dust-grey-600 hover:bg-dust-grey-50 hover:text-dust-grey-800 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
