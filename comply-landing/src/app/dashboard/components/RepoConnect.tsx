"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  Github,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Scan,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getGitHubStatus,
  getGitHubRepos,
  getGitHubAuthorizeUrl,
  triggerScan,
} from "@/lib/api";

interface Repo {
  full_name: string;
  owner: string;
  name: string;
}

type ConnectionState = "loading" | "disconnected" | "connected" | "scanning";

export default function RepoConnect() {
  const { getIdToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<ConnectionState>("loading");
  const [username, setUsername] = useState<string>("");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const checkGitHubStatus = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await getGitHubStatus(token);
      if (data.connected) {
        setUsername(data.username || "");
        setState("connected");
        // Fetch repos
        const repoData = await getGitHubRepos(token);
        setRepos(repoData.repos || []);
      } else {
        setState("disconnected");
      }
    } catch {
      setState("disconnected");
    }
  }, [getIdToken]);

  useEffect(() => {
    checkGitHubStatus();
  }, [checkGitHubStatus]);

  // Handle GitHub OAuth callback redirect
  useEffect(() => {
    if (searchParams.get("github") === "connected") {
      checkGitHubStatus();
    }
  }, [searchParams, checkGitHubStatus]);

  const handleConnect = async () => {
    const token = await getIdToken();
    if (!token) return;
    window.location.href = getGitHubAuthorizeUrl(token);
  };

  const handleScan = async () => {
    if (!selectedRepo) return;
    const token = await getIdToken();
    if (!token) return;

    setState("scanning");
    setError(null);

    try {
      const [owner, name] = selectedRepo.split("/");
      const result = await triggerScan(token, owner, name);
      router.push(`/dashboard/scan/${result.scan_id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start scan"
      );
      setState("connected");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="rounded-2xl border border-dust-grey-200 bg-white/80 shadow-xl shadow-dust-grey-200/40 backdrop-blur-sm p-6"
    >
      <h2 className="font-display italic text-xl font-bold text-dust-grey-950">
        Repository
      </h2>
      <p className="mt-1 text-sm text-dust-grey-600">
        Connect your GitHub account and select a repository to scan.
      </p>

      <div className="mt-5">
        {/* Loading state */}
        {state === "loading" && (
          <div className="flex items-center gap-2 text-dust-grey-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Checking GitHub connection...</span>
          </div>
        )}

        {/* Disconnected state */}
        {state === "disconnected" && (
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 rounded-xl bg-dust-grey-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-dust-grey-800 transition-colors"
          >
            <Github className="h-4 w-4" />
            Connect GitHub
          </button>
        )}

        {/* Connected state */}
        {(state === "connected" || state === "scanning") && (
          <div className="space-y-4">
            {/* Connected badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hunter-green-300/50 bg-hunter-green-100/40 px-3 py-1 text-xs font-medium text-hunter-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected as @{username}
              </span>
            </div>

            {/* Repo selector */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-dust-grey-700">
                  Select Repository
                </label>
                <div className="relative">
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    disabled={state === "scanning"}
                    className="w-full appearance-none rounded-xl border border-dust-grey-300 bg-white px-4 py-2.5 pr-10 text-sm text-dust-grey-800 focus:border-hunter-green-400 focus:outline-none focus:ring-1 focus:ring-hunter-green-400 disabled:opacity-50"
                  >
                    <option value="">Choose a repository...</option>
                    {repos.map((repo) => (
                      <option key={repo.full_name} value={repo.full_name}>
                        {repo.full_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dust-grey-400" />
                </div>
              </div>

              <button
                onClick={handleScan}
                disabled={!selectedRepo || state === "scanning"}
                className="flex items-center gap-2 rounded-xl bg-hunter-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-hunter-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state === "scanning" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4" />
                    Scan Repository
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}
      </div>
    </motion.div>
  );
}
