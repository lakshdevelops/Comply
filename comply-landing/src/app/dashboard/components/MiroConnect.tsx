"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { CheckCircle2, Loader2, LayoutTemplate } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getMiroStatus, getMiroAuthorizeUrl } from "@/lib/api";

type ConnectionState = "loading" | "disconnected" | "connected";

export default function MiroConnect() {
  const { getIdToken } = useAuth();
  const searchParams = useSearchParams();

  const [state, setState] = useState<ConnectionState>("loading");
  const [miroUserId, setMiroUserId] = useState<string | null>(null);

  const checkMiroStatus = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await getMiroStatus(token);
      if (data.connected) {
        setMiroUserId(data.miro_user_id || null);
        setState("connected");
      } else {
        setState("disconnected");
      }
    } catch {
      setState("disconnected");
    }
  }, [getIdToken]);

  useEffect(() => {
    checkMiroStatus();
  }, [checkMiroStatus]);

  // Handle Miro OAuth callback redirect
  useEffect(() => {
    if (searchParams.get("miro") === "connected") {
      checkMiroStatus();
    }
  }, [searchParams, checkMiroStatus]);

  const handleConnect = async () => {
    const token = await getIdToken();
    if (!token) return;
    window.location.href = getMiroAuthorizeUrl(token);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="rounded-2xl border border-warm-grey-200 bg-warm-grey-50 p-6"
    >
      <h2 className="font-display text-xl font-bold text-warm-grey-900">
        Miro
      </h2>
      <p className="mt-1 text-sm text-warm-grey-600">
        Connect Miro to export compliance diagrams directly to your boards.
      </p>

      <div className="mt-5">
        {/* Loading */}
        {state === "loading" && (
          <div className="flex items-center gap-2 text-warm-grey-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Checking Miro connection...</span>
          </div>
        )}

        {/* Disconnected */}
        {state === "disconnected" && (
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-medium text-yellow-950 hover:bg-yellow-300 transition-colors"
          >
            <LayoutTemplate className="h-4 w-4" />
            Connect Miro
          </button>
        )}

        {/* Connected */}
        {state === "connected" && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300/60 bg-yellow-100/50 px-3 py-1 text-xs font-medium text-yellow-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {miroUserId ? `Connected (${miroUserId})` : "Connected"}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
