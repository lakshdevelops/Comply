"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Home, LayoutDashboard } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";
import { PlanProvider } from "@/contexts/PlanContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <PlanProvider>
        <div className="min-h-screen bg-warm-white">
          <TopNav />
          <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </PlanProvider>
    </AuthGuard>
  );
}

function TopNav() {
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-50 border-b border-warm-grey-200 bg-warm-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="font-display text-xl font-semibold text-warm-grey-900">
          Comply
        </Link>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg border border-warm-grey-200 bg-warm-grey-50 px-3 py-1.5 text-sm font-medium text-warm-grey-700 hover:bg-warm-grey-100 transition-colors"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warm-brown-100 text-xs font-bold text-warm-brown-700">
                {initials}
              </span>
            )}
            <span className="hidden max-w-[120px] truncate sm:block">
              {user?.displayName ?? user?.email}
            </span>
          </button>

          <AnimatePresence>
            {profileOpen && (
              <>
                {/* Click-away overlay */}
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-warm-grey-200 bg-warm-white py-1.5 shadow-lg"
                >
                  <div className="px-3.5 py-2 border-b border-warm-grey-100">
                    <p className="text-xs font-medium text-warm-grey-500 truncate">{user?.email}</p>
                  </div>
                  <Link
                    href="/"
                    className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-warm-grey-700 hover:bg-warm-grey-50 transition-colors"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Home className="h-4 w-4 text-warm-grey-400" />
                    Home
                  </Link>
                  <button
                    onClick={async () => {
                      setProfileOpen(false);
                      await signOut();
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
