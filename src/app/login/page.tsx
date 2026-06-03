import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="overflow-hidden rounded-2xl border border-coffee-100 bg-white shadow-sm shadow-coffee-900/5">
        <div className="flex items-center gap-2.5 bg-coffee-900 px-6 py-5">
          <div className="leading-tight text-white">
            <p className="font-display text-xl font-bold">Vena Coffee Machine</p>
            <p className="text-xs font-semibold text-white/60">Officina</p>
          </div>
        </div>
        <div className="p-6">
          <h1 className="font-display text-xl font-bold text-coffee-900">Accesso officina</h1>
          <p className="mb-5 mt-1 text-sm text-coffee-400">
            Area riservata agli operatori. Gli account vengono creati dall'amministratore.
          </p>
          <Suspense fallback={<p className="text-sm text-coffee-400">Caricamento…</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
