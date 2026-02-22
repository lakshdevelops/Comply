"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, LogOut, LayoutDashboard, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, signOut } = useAuth();

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-warm-grey-200 bg-warm-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="/" className="font-display text-xl font-semibold tracking-tight text-warm-grey-900">
          Comply
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-warm-grey-600 transition-colors hover:text-warm-grey-900"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-lg border border-warm-grey-200 bg-warm-grey-50 px-3 py-1.5 text-sm font-medium text-warm-grey-700 hover:bg-warm-grey-100 transition-colors"
              >
                {user.photoURL ? (
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
                <span className="max-w-[120px] truncate">{user.displayName ?? user.email}</span>
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
                        <p className="text-xs font-medium text-warm-grey-500 truncate">{user.email}</p>
                      </div>
                      <a
                        href="/dashboard"
                        className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-warm-grey-700 hover:bg-warm-grey-50 transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        <LayoutDashboard className="h-4 w-4 text-warm-grey-400" />
                        Dashboard
                      </a>
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
          ) : (
            <>
              <a
                href="/auth/login"
                className="text-sm font-medium text-warm-grey-700 hover:text-warm-grey-900 transition-colors"
              >
                Sign In
              </a>
              <a
                href="/auth/signup"
                className="inline-flex items-center gap-1.5 rounded-lg bg-warm-brown-500 px-4 py-2 text-xs font-semibold text-white hover:bg-warm-brown-600 active:scale-95 transition-all duration-200"
              >
                Get Started
              </a>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-warm-grey-700 hover:text-warm-grey-900 transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-warm-grey-200/60 bg-warm-white/95"
          >
            <div className="flex flex-col gap-4 px-6 py-5">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-warm-grey-700 hover:text-warm-grey-900 transition-colors"
                >
                  {link.label}
                </a>
              ))}

              {user ? (
                <>
                  <div className="flex items-center gap-2 py-1">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warm-brown-100 text-xs font-bold text-warm-brown-700">
                        {initials}
                      </span>
                    )}
                    <span className="text-sm font-medium text-warm-grey-700 truncate">{user.displayName ?? user.email}</span>
                  </div>
                  <a
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium text-warm-grey-700 hover:text-warm-grey-900 transition-colors"
                  >
                    Dashboard
                  </a>
                  <button
                    onClick={async () => {
                      setOpen(false);
                      await signOut();
                    }}
                    className="text-left text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <a
                    href="/auth/login"
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium text-warm-grey-700 hover:text-warm-grey-900 transition-colors"
                  >
                    Sign In
                  </a>
                  <a
                    href="/auth/signup"
                    onClick={() => setOpen(false)}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-warm-brown-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-warm-brown-600 transition-colors"
                  >
                    Get Started
                  </a>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
