"use client";

import { motion } from "motion/react";
import RepoConnect from "./components/RepoConnect";
import ScanHistory from "./components/ScanHistory";

export default function DashboardPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-8"
    >
      <div>
        <h1 className="font-display italic text-2xl font-bold text-dust-grey-950">
          Compliance Dashboard
        </h1>
        <p className="mt-1 text-sm text-dust-grey-600">
          Connect your repository, scan for compliance violations, and ship
          fixes.
        </p>
      </div>

      <RepoConnect />
      <ScanHistory />
    </motion.div>
  );
}
