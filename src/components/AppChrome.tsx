"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Coffee,
  Home,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  Users,
  UserRound,
  Wrench,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/cn";

const primaryLinks = [
  { href: "/", label: "Schede", icon: Home },
  { href: "/manuale", label: "Manuale", icon: BookOpen },
  { href: "/dashboard-commerciale", label: "Dashboard", icon: BarChart3 },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/manutenzioni", label: "Manutenzioni", icon: Wrench },
  { href: "/opportunita", label: "Opportunità", icon: Target },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/vendite", label: "Vendite", icon: ShoppingBag },
  { href: "/prodotti", label: "Prodotti", icon: PackageSearch },
  { href: "/solleciti", label: "Solleciti", icon: Bell },
];

const utilityLinks = [
  { href: "/nuova", label: "Nuova scheda", icon: Plus, highlight: true },
  { href: "/configurazione", label: "Configurazione", icon: Settings },
  { href: "/admin/operatori", label: "Operatori", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, compact = false }: { item: any; pathname: string; compact?: boolean }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95",
        compact && "min-w-[76px] flex-col gap-1 px-2 py-1.5 text-[11px]",
        item.highlight
          ? "bg-arancio text-white shadow-sm hover:bg-arancio-dark"
          : active
            ? compact
              ? "bg-white text-coffee-900 shadow-sm"
              : "bg-arancio/20 text-arancio shadow-sm"
            : "text-coffee-50/55 hover:bg-white/10 hover:text-coffee-50",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", compact && "h-5 w-5")} />
      <span>{item.label}</span>
    </Link>
  );
}

function shouldHideChrome(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/r/");
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (shouldHideChrome(pathname)) return <>{children}</>;

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-coffee-900 px-4 py-5 text-white shadow-xl lg:flex">
        <Link href="/" className="mb-5 flex items-start gap-3 rounded-2xl bg-white/8 p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-arancio text-white shadow-md shadow-arancio/30">
            <Coffee className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold">Vena Coffee Machine</span>
            <span className="block text-xs font-semibold text-white/55">Officina</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {primaryLinks.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
          <div className="my-3 border-t border-white/10" />
          {utilityLinks.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="pt-4">
          <LogoutButton />
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee-800 bg-coffee-900/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl backdrop-blur lg:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {[...primaryLinks, utilityLinks[0]].map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} compact />
          ))}
        </div>
      </nav>

      <div className="pb-24 lg:pb-0">{children}</div>
    </div>
  );
}
