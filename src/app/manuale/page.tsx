import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Coffee,
  LogIn,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser, isAdminEmail } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

const lastUpdated = "5 luglio 2026";

const menuSections = [
  {
    href: "/",
    title: "Schede",
    icon: ClipboardList,
    text: "Dashboard dell'officina: cerca riparazioni, apri dettagli, cambia stato e crea nuove schede.",
  },
  {
    href: "/nuova",
    title: "Nuova scheda",
    icon: Plus,
    text: "Accettazione completa: cliente, macchina, storico per matricola, foto danni/graffi, GDPR, ricevuta e pagina cliente.",
  },
  {
    href: "/clienti",
    title: "Clienti",
    icon: Users,
    text: "Anagrafica, macchine associate, score, timeline, modifica cliente e storico commerciale.",
  },
  {
    href: "/vendite",
    title: "Vendite",
    icon: ShoppingBag,
    text: "Registra acquisti certi con prodotto, quantita, prezzo, data, pagamento, documento e macchina collegata.",
  },
  {
    href: "/prodotti",
    title: "Prodotti",
    icon: PackageSearch,
    text: "Catalogo con formato, caffe stimati, prezzo, margine e compatibilita con macchine.",
  },
  {
    href: "/agenda",
    title: "Agenda",
    icon: CalendarDays,
    text: "Vista giornaliera con calendario prenotazioni, manutenzioni da convertire, consigli utili con CTA e azioni commerciali.",
  },
  {
    href: "/manutenzioni",
    title: "Manutenzioni",
    icon: Wrench,
    text: "Programmazione preventiva, proposta cliente, link pubblico di prenotazione e collegamento alla scheda riparazione.",
  },
  {
    href: "/opportunita",
    title: "Opportunita",
    icon: Target,
    text: "Analisi di clienti e macchine con rischio o potenziale commerciale.",
  },
  {
    href: "/dashboard-commerciale",
    title: "Dashboard",
    icon: BarChart3,
    text: "Vista direzionale su vendite, rischi, azioni, manutenzioni e clienti da recuperare.",
  },
  {
    href: "/admin",
    title: "Admin",
    icon: Settings,
    text: "Hub riservato con Offerte, Configurazione, Operatori e stato WhatsApp.",
    adminOnly: true,
  },
];

const workflow = [
  "Accedi con nome operatore o email e password.",
  "Registra ogni nuova macchina da Nuova scheda.",
  "Inserisci matricola e controlla lo storico macchina prima di salvare.",
  "Classifica cliente e macchina: categoria uso, regime possesso, profilo attivita e stima caffe/giorno.",
  "Segna stato estetico, accessori, difetto e foto quando ci sono danni o graffi.",
  "Dal dettaglio assistenza aggiorna stato, diagnosi, preventivo e importo finale.",
  "Registra ogni vendita collegandola alla macchina quando possibile.",
  "Crea offerte solo da admin e usa il batch solo per clienti con consenso marketing.",
  "Controlla Agenda ogni giorno: calendario, azioni, manutenzioni da convertire e consigli utili.",
  "Genera Manutenzioni almeno una volta a settimana.",
  "Prepara il link cliente per prenotare la manutenzione ordinaria negli slot disponibili.",
  "Usa Dashboard per decidere dove intervenire commercialmente.",
  "Aggiorna Prodotti e Configurazione quando cambiano prezzi, soglie o regole.",
];

const rules = [
  "Comodato con pochi acquisti e assistenze frequenti: rischio alto.",
  "Ho.Re.Ca. sotto consumo atteso: recupero rapido.",
  "Assistenza recente senza vendite: possibile uso caffe concorrente.",
  "Rientro entro 90 giorni: controllare ricontrollo o garanzia.",
  "Difetto simile gia segnalato: leggere lo storico tecnico.",
  "Macchina sottodimensionata: valutare upgrade.",
  "Macchina sovradimensionata: valutare riallocazione.",
  "Vendite registrate bene: score piu affidabile.",
  "Manutenzione proposta prima della rottura: meno urgenze e meno sovraffollamento.",
  "Consigli utili: inviarli una tantum e usare CTA coerenti con macchina e consumo.",
];

const repairStates = [
  "Ingresso: Ricevuta",
  "In diagnosi: In analisi",
  "Attesa preventivo: Preventivo",
  "In riparazione: In lavorazione",
  "Riparata / cliente avvisato: Pronta per il ritiro",
  "Ritirata: Ritirata",
  "Non riparabile: Non riparabile",
  "Abbandonata: Chiusa",
];

export default async function ManualePage() {
  const user = await getCurrentUser();
  const admin = isAdminEmail(user?.email);
  const visibleMenuSections = menuSections.filter((item) => !item.adminOnly || admin);

  return (
    <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-5">
        <p className="text-sm font-semibold text-arancio">Guida operativa</p>
        <h1 className="font-display text-2xl font-bold text-coffee-50">Manuale Vena Coffee Machine</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-coffee-200">
          Questa guida spiega le voci principali dell'app e il flusso di lavoro consigliato per coordinare
          assistenza, vendite, manutenzioni e fidelizzazione dei clienti.
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-coffee-400">
          Aggiornato il {lastUpdated}
        </p>
      </header>

      <section className="mb-5 grid gap-3 lg:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <LogIn className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-50">Accesso</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-200">
            Entra con nome operatore o email. Gli account vengono creati dagli admin in Operatori.
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <BookOpen className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-50">Obiettivo</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-200">
            L'app non registra solo riparazioni: collega vendite, macchine e assistenza per capire fedelta,
            rischio comodati e opportunita commerciali.
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <Coffee className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-50">Dato chiave</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-200">
            Le vendite registrate sono il dato certo: servono per stimare copertura caffe, riordino,
            margine e rischio uso concorrente.
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <Target className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-50">Uso quotidiano</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-200">
            Agenda e Manutenzioni sono le due viste operative da controllare con continuita.
          </p>
        </Card>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 font-display text-xl font-bold text-coffee-50">Voci del menu</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleMenuSections.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.href} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-arancio/10 text-arancio">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-coffee-50">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-coffee-200">{item.text}</p>
                    <Link href={item.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-arancio underline-offset-2 hover:underline">
                      Apri voce
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 font-display text-xl font-bold text-coffee-50">Flusso consigliato</h2>
          <ol className="space-y-2 text-sm leading-6 text-coffee-200">
            {workflow.map((item, index) => (
              <li key={item} className="flex gap-2">
                <span className="font-bold text-arancio">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 font-display text-xl font-bold text-coffee-50">Regole pratiche</h2>
          <ul className="space-y-2 text-sm leading-6 text-coffee-200">
            {rules.map((item) => (
              <li key={item} className="rounded-xl border border-coffee-700/50 bg-coffee-800 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-5 p-4 sm:p-5">
        <h2 className="mb-3 font-display text-xl font-bold text-coffee-50">Stati riparazione</h2>
        <div className="grid gap-2 text-sm text-coffee-200 sm:grid-cols-2 lg:grid-cols-4">
          {repairStates.map((item) => (
            <span key={item} className="rounded-xl border border-coffee-700/50 bg-coffee-800 px-3 py-2 font-semibold">
              {item}
            </span>
          ))}
        </div>
      </Card>
    </main>
  );
}
