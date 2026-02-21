"use client";

import { motion } from "motion/react";

interface AuthCardProps {
  children: React.ReactNode;
}

export default function AuthCard({ children }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-[460px] rounded-2xl border border-dust-grey-200 bg-white/80 shadow-xl shadow-dust-grey-200/40 backdrop-blur-sm p-8"
    >
      {children}
    </motion.div>
  );
}
