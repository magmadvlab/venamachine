import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AcceptanceForm from "@/components/AcceptanceForm";
import { createServiceClient, missingSupabaseEnv } from "@/lib/supabase/server";
import type { NuovaAccettazione, ProfiloAttivita } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NuovaScheda({ searchParams }: { searchParams?: { prenotazione?: string; cliente?: string; macchina?: string } }) {
  let profiliAttivita: ProfiloAttivita[] = [];
  let initialValue: Partial<NuovaAccettazione> | undefined;
  let prenotazioneId: string | undefined;
  let clienteId: string | undefined;
  let macchinaId: string | undefined;
  let macchineCliente: any[] = [];

  if (missingSupabaseEnv().length === 0) {
    const db = createServiceClient();
    const { data } = await db
      .from("profili_attivita")
      .select("id, codice, nome, caffe_giornalieri_min, caffe_giornalieri_max")
      .order("nome", { ascending: true });
    profiliAttivita = (data ?? []) as ProfiloAttivita[];

    const requestedBookingId = searchParams?.prenotazione?.trim();
    if (requestedBookingId) {
      const { data: booking } = await db
        .from("v_prenotazioni_agenda")
        .select("id, cliente_id, macchina_id, descrizione, manutenzione_motivo")
        .eq("id", requestedBookingId)
        .maybeSingle();

      if (booking?.cliente_id && booking?.macchina_id) {
        const [{ data: cliente }, { data: macchina }] = await Promise.all([
          db
            .from("clienti")
            .select("tipo, ragione_sociale, piva_cf, indirizzo, telefono, email, consenso_gdpr, canale_preferito, profilo_attivita_id, caffe_giornalieri_attesi_override, note_fedelta")
            .eq("id", booking.cliente_id)
            .maybeSingle(),
          db
            .from("macchine")
            .select("marca, modello, colore, matricola, tipologia, categoria_utilizzo, regime_possesso")
            .eq("id", booking.macchina_id)
            .maybeSingle(),
        ]);

        prenotazioneId = booking.id;
        clienteId = booking.cliente_id;
        macchinaId = booking.macchina_id;
        initialValue = {
          cliente: {
            tipo: cliente?.tipo ?? "privato",
            ragione_sociale: cliente?.ragione_sociale ?? "",
            piva_cf: cliente?.piva_cf ?? "",
            indirizzo: cliente?.indirizzo ?? "",
            telefono: cliente?.telefono ?? "",
            email: cliente?.email ?? "",
            consenso_gdpr: Boolean(cliente?.consenso_gdpr),
            canale_preferito: cliente?.canale_preferito ?? "email",
            profilo_attivita_id: cliente?.profilo_attivita_id ?? undefined,
            caffe_giornalieri_attesi_override: cliente?.caffe_giornalieri_attesi_override ?? undefined,
            note_fedelta: cliente?.note_fedelta ?? undefined,
          },
          macchina: {
            marca: macchina?.marca ?? "",
            modello: macchina?.modello ?? "",
            colore: macchina?.colore ?? "",
            matricola: macchina?.matricola ?? "",
            tipologia: macchina?.tipologia ?? "capsule",
            categoria_utilizzo: macchina?.categoria_utilizzo ?? "ufficio",
            regime_possesso: macchina?.regime_possesso ?? "proprieta_cliente",
          },
          scheda: {
            accessori: [],
            preventivo_richiesto: false,
            difetto_cliente: booking.manutenzione_motivo ?? booking.descrizione ?? "Manutenzione ordinaria programmata",
          },
        };
      }
    }

    const requestedClienteId = searchParams?.cliente?.trim();
    const requestedMacchinaId = searchParams?.macchina?.trim();
    if (!initialValue && requestedClienteId) {
      const [{ data: cliente }, { data: macchina }] = await Promise.all([
        db
          .from("clienti")
          .select("tipo, ragione_sociale, piva_cf, indirizzo, telefono, email, consenso_gdpr, canale_preferito, profilo_attivita_id, caffe_giornalieri_attesi_override, note_fedelta")
          .eq("id", requestedClienteId)
          .maybeSingle(),
        requestedMacchinaId
          ? db
            .from("macchine")
            .select("id, cliente_id, marca, modello, colore, matricola, tipologia, categoria_utilizzo, regime_possesso")
            .eq("id", requestedMacchinaId)
            .eq("cliente_id", requestedClienteId)
            .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (cliente) {
        clienteId = requestedClienteId;
        macchinaId = macchina?.id;
        initialValue = {
          cliente: {
            tipo: cliente.tipo ?? "privato",
            ragione_sociale: cliente.ragione_sociale ?? "",
            piva_cf: cliente.piva_cf ?? "",
            indirizzo: cliente.indirizzo ?? "",
            telefono: cliente.telefono ?? "",
            email: cliente.email ?? "",
            consenso_gdpr: Boolean(cliente.consenso_gdpr),
            canale_preferito: cliente.canale_preferito ?? "email",
            profilo_attivita_id: cliente.profilo_attivita_id ?? undefined,
            caffe_giornalieri_attesi_override: cliente.caffe_giornalieri_attesi_override ?? undefined,
            note_fedelta: cliente.note_fedelta ?? undefined,
          },
          macchina: macchina ? {
            marca: macchina.marca ?? "",
            modello: macchina.modello ?? "",
            colore: macchina.colore ?? "",
            matricola: macchina.matricola ?? "",
            tipologia: macchina.tipologia ?? "capsule",
            categoria_utilizzo: macchina.categoria_utilizzo ?? "ufficio",
            regime_possesso: macchina.regime_possesso ?? "proprieta_cliente",
          } : undefined,
        };
      }
    }

    if (clienteId) {
      const { data: machineRows } = await db
        .from("macchine")
        .select("id, marca, modello, colore, matricola, tipologia, categoria_utilizzo, regime_possesso")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      macchineCliente = machineRows ?? [];
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-4 flex items-center gap-3 sm:mb-5">
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-700 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Schede</span>
        </Link>
        <h1 className="font-display text-lg font-bold text-coffee-900 sm:text-xl">Nuova accettazione</h1>
      </header>
      <AcceptanceForm
        profiliAttivita={profiliAttivita}
        initialValue={initialValue}
        prenotazioneId={prenotazioneId}
        clienteId={clienteId}
        macchinaId={macchinaId}
        macchineCliente={macchineCliente}
      />
    </main>
  );
}
