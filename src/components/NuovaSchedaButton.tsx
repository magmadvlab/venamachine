import Link from "next/link";
import { Plus } from "lucide-react";

export function NuovaSchedaButton() {
  return (
    <Link
      href="/nuova"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-arancio px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-arancio-dark active:scale-95"
    >
      <Plus className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Nuova scheda</span>
      <span className="sm:hidden">Nuova</span>
    </Link>
  );
}
