"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-warm-grey-200 bg-warm-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="#" className="font-display text-xl font-semibold tracking-tight text-warm-grey-900">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
