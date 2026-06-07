import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Coffee,
  PackageSearch,
  Settings,
  ShoppingBag,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const menuSections = [
  {
    href: "/",
    title: "Schede",
    icon: ClipboardList,
    text: "Dashboard dell'officina: cerca riparazioni, apri dettagli, cambia stato e crea nuove schede.",
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
    text: "Registra acquisti certi di caffe/prodotti con quantita, prezzo, data, pagamento e macchina collegata.",
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
    text: "Azioni commerciali generate da rischio comodato, riordino, calo vendite, upgrade e assistenza.",
  },
  {
    href: "/manutenzioni",
    title: "Manutenzioni",
    icon: Wrench,
    text: "Programmazione preventiva basata su uso stimato, tempo, categoria macchina e segnali tecnici.",
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
    href: "/configurazione",
    title: "Configurazione",
    icon: Settings,
    text: "Soglie, profili attivita, regole azioni e impostazioni score modificabili dall'app.",
  },
];

const workflow = [
  "Registra ogni nuova macchina da Nuova scheda.",
  "Classifica cliente e macchina: categoria uso, regime possesso e profilo attivita.",
  "Registra ogni vendita collegandola alla macchina quando possibile.",
  "Controlla Agenda ogni giorno e salva esiti/follow-up.",
  "Genera Manutenzioni almeno una volta a settimana.",
  "Usa Dashboard per decidere dove intervenire commercialmente.",
  "Aggiorna Prodotti e Configurazione quando cambiano prezzi, soglie o regole.",
];

const rules = [
  "Comodato con pochi acquisti e assistenze frequenti: rischio alto.",
  "Ho.Re.Ca. sotto consumo atteso: recupero rapido.",
  "Assistenza recente senza vendite: possibile uso caffe concorrente.",
  "Macchina sottodimensionata: valutare upgrade.",
  "Macchina sovradimensionata: valutare riallocazione.",
  "Vendite registrate bene: score piu affidabile.",
];

export default function ManualePage() {
  return (
    <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 sm:pt-6">
      <header className="mb-5">
        <p className="text-sm font-semibold text-arancio-dark">Guida operativa</p>
        <h1 className="font-display text-2xl font-bold text-coffee-900">Manuale Vena Coffee Machine</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-coffee-600">
          Questa guida spiega le voci principali dell'app e il flusso di lavoro consigliato per coordinare
          assistenza, vendite, manutenzioni e fidelizzazione dei clienti.
        </p>
      </header>

      <section className="mb-5 grid gap-3 lg:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <BookOpen className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-900">Obiettivo</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-600">
            L'app non registra solo riparazioni: collega vendite, macchine e assistenza per capire fedelta,
            rischio comodati e opportunita commerciali.
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <Coffee className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-900">Dato chiave</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-600">
            Le vendite registrate sono il dato certo: servono per stimare copertura caffe, riordino,
            margine e rischio uso concorrente.
          </p>
        </Card>
        <Card className="p-4 sm:p-5">
          <Target className="h-6 w-6 text-arancio" />
          <h2 className="mt-3 font-display text-lg font-semibold text-coffee-900">Uso quotidiano</h2>
          <p className="mt-2 text-sm leading-6 text-coffee-600">
            Agenda e Manutenzioni sono le due viste operative da controllare con continuita.
          </p>
        </Card>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 font-display text-xl font-bold text-coffee-900">Voci del menu</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {menuSections.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.href} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-arancio/10 text-arancio">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-coffee-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-coffee-600">{item.text}</p>
                    <Link href={item.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-arancio-dark underline-offset-2 hover:underline">
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
          <h2 className="mb-3 font-display text-xl font-bold text-coffee-900">Flusso consigliato</h2>
          <ol className="space-y-2 text-sm leading-6 text-coffee-700">
            {workflow.map((item, index) => (
              <li key={item} className="flex gap-2">
                <span className="font-bold text-arancio-dark">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="mb-3 font-display text-xl font-bold text-coffee-900">Regole pratiche</h2>
          <ul className="space-y-2 text-sm leading-6 text-coffee-700">
            {rules.map((item) => (
              <li key={item} className="rounded-xl border border-coffee-100 bg-coffee-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
