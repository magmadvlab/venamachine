import { cn } from "@/lib/cn";

const stadioColore: Record<string, string> = {
  "Ricevuta": "bg-coffee-100 text-coffee-700",
  "In analisi": "bg-amber-100 text-amber-800",
  "Preventivo": "bg-sky-100 text-sky-800",
  "In lavorazione": "bg-arancio/15 text-arancio-dark",
  "Pronta per il ritiro": "bg-emerald-100 text-emerald-800",
  "Ritirata": "bg-stone-200 text-stone-600",
  "Chiusa": "bg-stone-200 text-stone-600",
};

export function Badge({ stadio, className }: { stadio: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        stadioColore[stadio] ?? "bg-coffee-100 text-coffee-700",
        className,
      )}
    >
      {stadio}
    </span>
  );
}
