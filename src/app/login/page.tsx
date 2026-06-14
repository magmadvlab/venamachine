import { Suspense } from "react";
import { Coffee } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col sm:items-center sm:justify-center sm:bg-coffee-950">
      <div className="flex w-full flex-1 flex-col sm:max-w-sm sm:flex-none sm:overflow-hidden sm:rounded-3xl sm:shadow-2xl sm:shadow-black/60">

        {/* Metà superiore — cream */}
        <div
          className="flex flex-1 flex-col items-center justify-center gap-5 px-8 py-14 sm:flex-none sm:py-12"
          style={{ background: "linear-gradient(180deg, #faf7f4 0%, #f0e4d4 100%)" }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-arancio shadow-lg shadow-arancio/40">
            <Coffee className="h-10 w-10 text-white" />
          </div>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-coffee-900">Vena Coffee Machine</p>
            <p className="mt-1 text-sm font-semibold text-coffee-400">Officina</p>
          </div>
        </div>

        {/* Metà inferiore — dark */}
        <div className="rounded-t-[2rem] bg-coffee-900 px-8 pb-10 pt-8 sm:rounded-none">
          <h1 className="font-display text-2xl font-bold text-coffee-50">Accedi</h1>
          <p className="mb-6 mt-1 text-sm text-coffee-400">
            Area riservata agli operatori.
          </p>
          <Suspense fallback={<p className="text-sm text-coffee-400">Caricamento…</p>}>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-xs text-coffee-400">
            Problemi di accesso? Contatta l'amministratore.
          </p>
        </div>

      </div>
    </main>
  );
}
