"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loginIdentifier } from "@/lib/operator-username";

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
        email: loginIdentifier(email),
        password,
      });
      if (error) {
        setErrore("Nome/email o password non corretti.");
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
    "w-full rounded-xl border border-coffee-700 bg-coffee-800 px-3 py-3 text-base text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="email">Nome operatore o email</label>
        <input
          id="email"
          type="text"
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
        <p className="rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-300">{errore}</p>
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
