"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    if (password.length < 8) {
      setErrore("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== conferma) {
      setErrore("Le due password non coincidono.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });
      if (error) {
        setErrore(error.message || "Aggiornamento password non riuscito.");
        setLoading(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setErrore("Aggiornamento password non riuscito. Riprova.");
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-coffee-700 bg-coffee-800 px-3 py-3 text-base text-coffee-50 placeholder:text-coffee-400 outline-none focus:border-arancio focus:ring-2 focus:ring-arancio/20";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-coffee-400";

  return (
    <form onSubmit={submit} className="space-y-4">
      {forced && (
        <p className="rounded-xl border border-arancio/30 bg-arancio/10 px-3 py-2 text-sm text-arancio">
          Prima di continuare devi impostare una nuova password.
        </p>
      )}
      <div>
        <label className={labelCls} htmlFor="password">Nuova password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="conferma">Conferma nuova password</label>
        <input
          id="conferma"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={conferma}
          onChange={(e) => setConferma(e.target.value)}
          className={inputCls}
        />
      </div>
      {errore && <p className="text-sm font-semibold text-red-400">{errore}</p>}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-arancio px-4 py-3 text-sm font-bold text-white active:scale-[0.99] disabled:opacity-60"
      >
        <KeyRound className="h-4 w-4" />
        {loading ? "Salvataggio..." : "Salva nuova password"}
      </button>
    </form>
  );
}
