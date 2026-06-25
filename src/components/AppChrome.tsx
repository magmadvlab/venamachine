"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BadgePercent,
  Bell,
  BookOpen,
  CalendarDays,
  Coffee,
  Home,
  Menu,
  PackageSearch,
  Plus,
  Settings,
  ShoppingBag,
  Target,
  Users,
  UserRound,
  Wrench,
  X,
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

const operatorUtilityLinks = [
  { href: "/nuova", label: "Nuova scheda", icon: Plus, highlight: true },
];

const adminUtilityLinks = [
  { href: "/offerte", label: "Offerte", icon: BadgePercent },
  { href: "/configurazione", label: "Configurazione", icon: Settings },
  { href: "/admin/operatori", label: "Operatori", icon: UserRound },
];

const mobilePrimaryLinks = [
  primaryLinks[0],
  primaryLinks[3],
  operatorUtilityLinks[0],
  primaryLinks[6],
];

const baseMobileMoreLinks = [
  primaryLinks[1],
  primaryLinks[2],
  primaryLinks[4],
  primaryLinks[5],
  primaryLinks[7],
  primaryLinks[8],
  primaryLinks[9],
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

function MobileNavLink({ item, pathname }: { item: any; pathname: string }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition active:scale-95",
        item.highlight
          ? "text-arancio"
          : active
            ? "bg-white/10 text-coffee-50"
            : "text-coffee-400",
      )}
    >
      <span className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full",
        item.highlight && "bg-arancio text-white shadow-md shadow-arancio/30",
      )}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="max-w-full truncate">{item.highlight ? "Nuova" : item.label}</span>
    </Link>
  );
}

function shouldHideChrome(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/r/") || (pathname !== "/offerte" && pathname.startsWith("/offerte/"));
}

export function AppChrome({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  if (shouldHideChrome(pathname)) return <>{children}</>;

  const utilityLinks = admin ? [...operatorUtilityLinks, ...adminUtilityLinks] : operatorUtilityLinks;
  const mobileMoreLinks = admin ? [...baseMobileMoreLinks, ...adminUtilityLinks] : baseMobileMoreLinks;
  const moreSectionActive = mobileMoreLinks.some((item) => isActive(pathname, item.href));

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-coffee-900 px-4 py-5 text-white shadow-xl lg:flex">
        <Link href="/" className="mb-5 flex items-start gap-3 rounded-2xl bg-white/10 p-3">
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

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Chiudi menu"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-coffee-700 bg-coffee-900 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-arancio">Navigazione</p>
                <h2 id="mobile-menu-title" className="font-display text-xl font-bold text-coffee-50">Tutte le sezioni</h2>
              </div>
              <button
                type="button"
                aria-label="Chiudi"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-coffee-800 text-coffee-200 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {mobileMoreLinks.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition active:scale-95",
                      active
                        ? "border-arancio/50 bg-arancio/15 text-arancio"
                        : "border-coffee-700/50 bg-coffee-800 text-coffee-200",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee-800 bg-coffee-900/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-2xl backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryLinks.map((item) => (
            <MobileNavLink key={item.href} item={item} pathname={pathname} />
          ))}
          <button
            type="button"
            aria-label="Apri tutte le sezioni"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition active:scale-95",
              moreSectionActive || mobileMenuOpen
                ? "bg-white/10 text-coffee-50"
                : "text-coffee-400",
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full">
              <Menu className="h-5 w-5" />
            </span>
            <span>Altro</span>
          </button>
        </div>
      </nav>

      <div className="pb-24 lg:pb-0">{children}</div>
    </div>
  );
}
