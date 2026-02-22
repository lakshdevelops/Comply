"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Calculator } from "lucide-react";

const UNIT_PRICES = [
  { metric: "Agent executions", price: "€0.03", unit: "run" },
  { metric: "Infra scans", price: "€0.10", unit: "scan" },
  { metric: "Pull requests", price: "€0.50", unit: "PR" },
  { metric: "Legal reasoning", price: "€0.02", unit: "1k tokens" },
];

export default function UsageCalculator() {
  const [repos, setRepos] = useState(3);
  const [scansPerWeek, setScansPerWeek] = useState(10);
  const [prsPerWeek, setPrsPerWeek] = useState(5);

  const monthlyCost = useMemo(() => {
    const weeksPerMonth = 4.3;
    const scans = repos * scansPerWeek * weeksPerMonth * 0.1;
    const prs = prsPerWeek * weeksPerMonth * 0.5;
    const agentRuns = repos * scansPerWeek * weeksPerMonth * 0.03;
    return Math.round((scans + prs + agentRuns) * 100) / 100;
  }, [repos, scansPerWeek, prsPerWeek]);

  return (
    <section className="py-24 relative">
      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-warm-brown-500">
            Usage-Based Pricing
          </p>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-warm-grey-900 sm:text-3xl">
            Pay only for what your{" "}
            <span className="accent-text">agents execute</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-warm-grey-600">
            AI agents consume compute dynamically. Instead of charging per seat,
            Comply charges only for what your agents execute.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Pricing table */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-7"
          >
            <div className="flex items-center gap-2 mb-6">
              <Calculator className="h-5 w-5 text-warm-brown-500" />
              <h3 className="font-display text-lg font-bold text-warm-grey-900">
                Unit Pricing
              </h3>
            </div>
            <div className="space-y-0 divide-y divide-warm-grey-200">
              {UNIT_PRICES.map((row) => (
                <div
                  key={row.metric}
                  className="flex items-center justify-between py-3"
                >
                  <span className="text-sm text-warm-grey-700">
                    {row.metric}
                  </span>
                  <span className="font-mono text-sm font-semibold text-warm-grey-900">
                    {row.price}{" "}
                    <span className="text-warm-grey-400 font-normal">
                      / {row.unit}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Interactive calculator */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-7"
          >
            <h3 className="font-display text-lg font-bold text-warm-grey-900 mb-6">
              Estimate Your Usage
            </h3>

            <div className="space-y-6">
              {/* Repos slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-warm-grey-700">
                    Repositories
                  </label>
                  <span className="font-mono text-sm font-semibold text-warm-brown-600">
                    {repos}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={repos}
                  onChange={(e) => setRepos(Number(e.target.value))}
                  className="w-full accent-warm-brown-500 h-1.5 rounded-full bg-warm-grey-200 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-warm-brown-500 [&::-webkit-slider-thumb]:shadow-sm"
                />
              </div>

              {/* Scans per week slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-warm-grey-700">
                    Scans / week
                  </label>
                  <span className="font-mono text-sm font-semibold text-warm-brown-600">
                    {scansPerWeek}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={scansPerWeek}
                  onChange={(e) => setScansPerWeek(Number(e.target.value))}
                  className="w-full accent-warm-brown-500 h-1.5 rounded-full bg-warm-grey-200 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-warm-brown-500 [&::-webkit-slider-thumb]:shadow-sm"
                />
              </div>

              {/* PR frequency slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-warm-grey-700">
                    PRs / week
                  </label>
                  <span className="font-mono text-sm font-semibold text-warm-brown-600">
                    {prsPerWeek}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={prsPerWeek}
                  onChange={(e) => setPrsPerWeek(Number(e.target.value))}
                  className="w-full accent-warm-brown-500 h-1.5 rounded-full bg-warm-grey-200 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-warm-brown-500 [&::-webkit-slider-thumb]:shadow-sm"
                />
              </div>
            </div>

            {/* Dynamic cost preview */}
            <div className="mt-8 rounded-xl border border-warm-brown-200 bg-warm-brown-50/40 p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-warm-grey-500 mb-1">
                Estimated monthly usage cost
              </p>
              <motion.p
                key={monthlyCost}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-4xl font-extrabold text-warm-grey-900"
              >
                €{monthlyCost.toFixed(2)}
                <span className="text-base font-normal text-warm-grey-500">
                  {" "}
                  / mo
                </span>
              </motion.p>
              <p className="mt-2 text-xs text-warm-grey-400">
                On top of your base subscription
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
