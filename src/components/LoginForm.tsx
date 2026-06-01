"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrore("Email o password non corretti.");
        setLoading(false);
        return;
      }
      router.replace(redirect);
      router.refresh();
    } catch {
      setErrore("Accesso non riuscito. Riprova.");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-coffee-200 bg-white px-3 py-3 text-base text-coffee-900 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </div>

      {errore && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errore}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-arancio py-3.5 text-base font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-[0.99] disabled:opacity-60"
      >
        <LogIn className="h-5 w-5" />
        {loading ? "Accesso…" : "Entra"}
      </button>
    </form>
  );
}
