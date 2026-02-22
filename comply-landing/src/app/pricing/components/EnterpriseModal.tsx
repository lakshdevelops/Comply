"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle2, Loader2 } from "lucide-react";
import { submitEnterpriseContact } from "@/lib/api";

interface EnterpriseModalProps {
  open: boolean;
  onClose: () => void;
}

export default function EnterpriseModal({ open, onClose }: EnterpriseModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setCompany("");
    setMessage("");
    setSuccess(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await submitEnterpriseContact(name, email, company, message);
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-warm-grey-300 bg-white px-4 py-2.5 text-sm text-warm-grey-900 placeholder-warm-grey-400 focus:border-warm-brown-400 focus:ring-1 focus:ring-warm-brown-400 focus:outline-none transition-colors";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-warm-grey-900/40 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl border border-warm-grey-200 bg-warm-white p-7 shadow-xl"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-warm-grey-400 hover:text-warm-grey-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {success ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <h4 className="font-display text-lg font-bold text-warm-grey-900">
                  We&apos;ll be in touch!
                </h4>
                <p className="text-sm text-warm-grey-600">
                  Our team will reach out within 24 hours.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-4 rounded-xl border border-warm-grey-300 bg-warm-grey-100 px-5 py-2 text-sm font-medium text-warm-grey-900 hover:bg-warm-grey-200 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-display text-xl font-bold text-warm-grey-900 mb-1">
                  Request Enterprise Access
                </h3>
                <p className="text-sm text-warm-grey-500 mb-6">
                  Unlimited repos, legal advisor, SSO, and dedicated support.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-warm-grey-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Smith"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-grey-700 mb-1">
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-grey-700 mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      required
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Acme Corp"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-grey-700 mb-1">
                      Message{" "}
                      <span className="text-warm-grey-400 font-normal">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us about your compliance needs…"
                      className={inputClass + " resize-none"}
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-warm-brown-500 px-6 py-3 text-sm font-semibold text-white hover:bg-warm-brown-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                      </>
                    ) : (
                      "Request Access"
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
