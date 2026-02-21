"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function TestPage() {
  const { user, loading, signInWithGoogle, signOut, getIdToken } = useAuth();
  const [result, setResult] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const pingBackend = async () => {
    setIsFetching(true);
    setResult(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setResult("No token — sign in first.");
        return;
      }
      const res = await fetch("http://localhost:8000/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsFetching(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-dust-grey-50">
        <p className="text-dry-sage-600 text-sm">Loading auth state…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dust-grey-50 flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold text-dust-grey-950">Backend Auth Test</h1>

      {/* Auth state */}
      <div className="w-full max-w-md rounded-xl border border-dust-grey-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-dry-sage-500 mb-3">
          Firebase Auth State
        </p>
        {user ? (
          <div className="flex flex-col gap-1 text-sm text-dust-grey-800">
            <p><span className="font-medium">Name:</span> {user.displayName}</p>
            <p><span className="font-medium">Email:</span> {user.email}</p>
            <p><span className="font-medium">UID:</span> {user.uid}</p>
          </div>
        ) : (
          <p className="text-sm text-dry-sage-500">Not signed in.</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {!user ? (
          <button
            onClick={signInWithGoogle}
            className="rounded-xl bg-fern-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-fern-800 transition-colors"
          >
            Sign in with Google
          </button>
        ) : (
          <>
            <button
              onClick={pingBackend}
              disabled={isFetching}
              className="rounded-xl bg-fern-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-fern-800 transition-colors disabled:opacity-60"
            >
              {isFetching ? "Calling backend…" : "Ping /api/v1/auth/me"}
            </button>
            <button
              onClick={signOut}
              className="rounded-xl border border-dust-grey-300 bg-white px-5 py-2.5 text-sm font-semibold text-dust-grey-700 hover:bg-dust-grey-50 transition-colors"
            >
              Sign out
            </button>
          </>
        )}
      </div>

      {/* Backend response */}
      {result && (
        <div className="w-full max-w-md rounded-xl border border-dust-grey-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-dry-sage-500 mb-3">
            Backend Response
          </p>
          <pre className="text-sm text-dust-grey-800 whitespace-pre-wrap break-all">{result}</pre>
        </div>
      )}
    </main>
  );
}
