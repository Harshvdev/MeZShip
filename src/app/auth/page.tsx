"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Shield, ArrowRight, Loader2, Radio } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/common/Logo";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        setMessage("Constellation link dispatched. Check your email inbox.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch auth link.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (googleError) setError(googleError.message);
    } catch (err: any) {
      setError(err?.message || "Google sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-ink text-paper font-body">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-surface border border-line shadow-2xl animate-fade-in relative">
        <div className="flex flex-col items-center text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-3 group">
            <div className="w-12 h-12 rounded-xl bg-surface-raised border border-signal/40 flex items-center justify-center text-signal group-hover:border-signal group-hover:shadow-[0_0_16px_rgba(47,228,141,0.3)] transition-all shadow-sm">
              <Logo size={32} withGlow className="group-hover:scale-105 transition-transform" />
            </div>
          </Link>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-paper tracking-tight">
            Connect Signal Station
          </h2>
          <p className="font-mono text-xs text-ash mt-1 max-w-xs">
            ANONYMOUS · LOCAL PROXIMITY · VOLATILE
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-alert/10 border border-alert/20 text-alert text-xs font-mono">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 rounded-lg bg-signal/10 border border-signal/20 text-signal text-xs font-mono">
            {message}
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-surface-raised hover:bg-surface border border-line hover:border-line-bright text-paper font-medium text-xs sm:text-sm transition-all mb-4 disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-line" />
          <span className="font-mono text-[10px] text-ash uppercase tracking-wider">
            or single-use link
          </span>
          <div className="flex-1 h-px bg-line" />
        </div>

        {/* Email Magic Link Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div>
            <label className="block font-mono text-[11px] text-ash mb-1">
              CAMPUS / PERSONAL EMAIL
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="identity@campus.edu"
                required
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface-raised border border-line focus:border-signal focus:outline-none text-xs sm:text-sm text-paper placeholder-ash/50 transition-colors font-mono"
              />
              <Mail className="w-4 h-4 text-ash absolute left-3 top-2.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="btn-ptt w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-display font-bold text-xs sm:text-sm shadow-md disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-ink" />
            ) : (
              <>
                <span>Send Signal Key</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-3 border-t border-line flex items-center justify-center gap-2 font-mono text-[10px] text-ash">
          <Shield className="w-3.5 h-3.5 text-signal" />
          <span>Pseudonymous Identity · Volatile RAM Protocol</span>
        </div>
      </div>
    </div>
  );
}

