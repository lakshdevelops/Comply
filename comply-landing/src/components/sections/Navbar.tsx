"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, ShieldCheck } from "lucide-react";

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-dust-grey-200/60 bg-dust-grey-50/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hunter-green-300 group-hover:bg-hunter-green-400 transition-colors">
            <ShieldCheck className="h-4 w-4 text-hunter-green-900" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-fern-800">
            Comply
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-dry-sage-600 transition-colors hover:text-fern-800"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/auth/login"
            className="text-sm font-medium text-dry-sage-700 hover:text-fern-800 transition-colors"
          >
            Sign In
          </a>
          <a
            href="/auth/signup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-fern-700 px-4 py-2 text-xs font-semibold text-white hover:bg-fern-800 active:scale-95 transition-all duration-200"
          >
            Get Started
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-dry-sage-700 hover:text-dust-grey-950 transition-colors"
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
            className="md:hidden overflow-hidden border-t border-dust-grey-200/60 bg-dust-grey-50/95"
          >
            <div className="flex flex-col gap-4 px-6 py-5">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-dry-sage-700 hover:text-fern-800 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-dry-sage-700 hover:text-fern-800 transition-colors"
              >
                Sign In
              </a>
              <a
                href="/auth/signup"
                onClick={() => setOpen(false)}
                className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-fern-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-fern-800 transition-colors"
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
