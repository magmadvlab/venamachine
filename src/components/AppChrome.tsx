"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BarChart3,
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
  Users,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: typeof Home; highlight?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Lavoro quotidiano",
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
    ],
  },
  {
    label: "Clienti",
    items: [
      { href: "/clienti", label: "Clienti", icon: Users },
    ],
  },
  {
    label: "Report",
    items: [
      { href: "/dashboard-commerciale", label: "Report", icon: BarChart3 },
      { href: "/vendite", label: "Vendite", icon: ShoppingBag },
      { href: "/incassi", label: "Incassi", icon: Banknote },
    ],
  },
];

const allGroupedLinks = navGroups.flatMap((group) => group.items);

const operatorUtilityLinks: NavItem[] = [
  { href: "/nuova", label: "Nuova scheda", icon: Plus, highlight: true },
  { href: "/prodotti", label: "Prodotti", icon: PackageSearch },
  { href: "/manuale", label: "Manuale", icon: BookOpen },
  { href: "/notifiche", label: "Notifiche", icon: Bell },
];

const adminUtilityLinks: NavItem[] = [
  { href: "/admin", label: "Admin", icon: Settings },
];

const allLinks = [...allGroupedLinks, ...operatorUtilityLinks, ...adminUtilityLinks];

// Lancia in fase di module-eval (non a runtime condizionale) se un href non corrisponde
// a nessuna voce: AppChrome è nel root layout, quindi un typo qui blocca subito la build/dev
// invece di far sparire silenziosamente una voce di navigazione (come il bug del badge Incassi).
function findLink(href: string): NavItem {
  const link = allLinks.find((item) => item.href === href);
  if (!link) throw new Error(`AppChrome: nessuna voce di navigazione per ${href}`);
  return link;
}

const mobilePrimaryLinks = [
  findLink("/"),
  findLink("/agenda"),
  findLink("/nuova"),
  findLink("/clienti"),
];

const baseMobileMoreLinks = [
  findLink("/dashboard-commerciale"),
  findLink("/vendite"),
  findLink("/incassi"),
  findLink("/prodotti"),
  findLink("/manuale"),
  findLink("/notifiche"),
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, compact = false, badge = 0 }: { item: NavItem; pathname: string; compact?: boolean; badge?: number }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-95",
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
      {badge > 0 && (
        <span className="absolute right-2 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

function MobileNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
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
  return pathname === "/login"
    || pathname.startsWith("/r/")
    || pathname.startsWith("/manutenzione/")
    || pathname.startsWith("/prenotazioni/")
    || (pathname !== "/offerte" && pathname.startsWith("/offerte/"));
}

export function AppChrome({ children, admin = false, incassiCount = 0 }: { children: React.ReactNode; admin?: boolean; incassiCount?: number }) {
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
          {navGroups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wide text-white/40">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} badge={item.href === "/incassi" ? incassiCount : 0} />
              ))}
            </div>
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
