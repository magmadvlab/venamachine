import { cn } from "@/lib/cn";

const stadioColore: Record<string, string> = {
  "Ricevuta":             "bg-coffee-800 text-coffee-200",
  "In analisi":           "bg-amber-900/50 text-amber-300",
  "Preventivo":           "bg-sky-900/50 text-sky-300",
  "In lavorazione":       "bg-arancio/20 text-arancio",
  "Pronta per il ritiro": "bg-emerald-900/50 text-emerald-300",
  "Ritirata":             "bg-coffee-800 text-coffee-400",
  "Chiusa":               "bg-coffee-800 text-coffee-400",
};

export function Badge({ stadio, className }: { stadio: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        stadioColore[stadio] ?? "bg-coffee-800 text-coffee-200",
        className,
      )}
    >
      {stadio}
    </span>
  );
}
