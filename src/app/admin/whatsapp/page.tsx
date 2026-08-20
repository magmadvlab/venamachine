import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, MessageCircle, QrCode, RefreshCcw, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";
import { getWhatsAppHealth, whatsappConfigured } from "@/lib/whatsapp-gateway";

export const dynamic = "force-dynamic";

export default async function AdminWhatsAppPage() {
  const user = await getCurrentUser();
  if (!isAdminEmail(user?.email)) redirect("/");

  const configured = whatsappConfigured();
  const health: any = await getWhatsAppHealth();
  const state = health?.body?.state ?? null;
  const connected = Boolean(health?.ok);
  const statusLabel = !configured
    ? "Da configurare"
    : connected
      ? "Connesso"
      : state === "connecting"
        ? "In attesa del QR"
        : "Da collegare";

  return (
    <main className="mx-auto max-w-5xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-700 bg-coffee-900 px-3 text-sm font-semibold text-coffee-50 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Admin</span>
        </Link>
        <div className="flex-1">
          <p className="text-sm font-semibold text-arancio">Collegamento servizio</p>
          <h1 className="font-display text-xl font-bold text-coffee-50">WhatsApp</h1>
        </div>
        <Link
          href="/admin/whatsapp"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-coffee-700 bg-coffee-900 px-3 text-sm font-semibold text-coffee-50 active:scale-95"
        >
          <RefreshCcw className="h-4 w-4 text-arancio" />
          Aggiorna
        </Link>
      </header>

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="border-arancio/30 bg-coffee-900 text-coffee-50">
          <MessageCircle className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-50">Stato</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-100">{statusLabel}</p>
          {health?.instance && (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-coffee-300">
              Istanza: {health.instance}
            </p>
          )}
        </Card>

        <Card className="border-arancio/30 bg-coffee-900 text-coffee-50">
          {connected ? <CheckCircle2 className="h-6 w-6 text-green-400" /> : <AlertTriangle className="h-6 w-6 text-arancio" />}
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-50">Sessione WhatsApp Web</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-100">
            {connected
              ? "Il numero è collegato. Gli invii in outbox possono partire dal worker."
              : "Scansiona il QR con il telefono dell'attività per collegare il numero."}
          </p>
        </Card>

        <Card className="border-arancio/30 bg-coffee-900 text-coffee-50">
          <Smartphone className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-50">Telefono</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-100">
            Apri WhatsApp sul telefono: Impostazioni, Dispositivi collegati, Collega un dispositivo.
          </p>
        </Card>
      </section>

      {!configured ? (
        <Card className="border-red-200 bg-red-50 text-red-950">
          <h2 className="font-display text-lg font-semibold">Servizio non configurato</h2>
          <p className="mt-2 text-sm leading-6">
            La pagina è pronta, ma il servizio web deve avere WA_GATEWAY_URL, WA_GATEWAY_TOKEN e WA_INSTANCE. Questa configurazione tecnica va fatta una sola volta.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-arancio/30 bg-coffee-900 p-4 text-coffee-50 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-coffee-50">
              <QrCode className="h-5 w-5 text-arancio" />
              QR WhatsApp Web
            </h2>
            <div className="overflow-hidden rounded-xl border border-coffee-700 bg-white">
              <iframe
                title="QR collegamento WhatsApp"
                src="/api/admin/whatsapp/qr"
                className="h-[460px] w-full bg-white"
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-coffee-100">
              Il QR si aggiorna automaticamente. Quando la connessione è riuscita, il riquadro mostra WhatsApp connesso.
            </p>
          </Card>

          <Card className="border-arancio/30 bg-coffee-900 p-4 text-coffee-50 sm:p-5">
            <h2 className="font-display text-lg font-semibold text-coffee-50">Come collegare</h2>
            <ol className="mt-3 space-y-3 text-sm leading-6 text-coffee-100">
              <li><strong className="text-arancio">1.</strong> Tieni aperta questa pagina.</li>
              <li><strong className="text-arancio">2.</strong> Sul telefono apri WhatsApp.</li>
              <li><strong className="text-arancio">3.</strong> Vai in Dispositivi collegati.</li>
              <li><strong className="text-arancio">4.</strong> Tocca Collega un dispositivo.</li>
              <li><strong className="text-arancio">5.</strong> Inquadra il QR mostrato a sinistra.</li>
            </ol>
            {health?.error && (
              <p className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm leading-6 text-red-900">
                {health.error}
              </p>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}
