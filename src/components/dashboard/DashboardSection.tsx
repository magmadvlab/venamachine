"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type DashboardSectionTone = "danger" | "warning" | "info" | "neutral";

export type DashboardSectionRow = {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: DashboardSectionTone };
};

const TONE_CLASSES: Record<DashboardSectionTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  neutral: "border-coffee-200 bg-white text-coffee-700",
};

export function DashboardSection({
  icon: Icon,
  title,
  rows,
  emptyLabel,
  initialVisible = 5,
  headerAction,
}: {
  icon: LucideIcon;
  title: string;
  rows: DashboardSectionRow[];
  emptyLabel: string;
  initialVisible?: number;
  headerAction?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, initialVisible);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-coffee-50">
          <Icon className="h-5 w-5 text-arancio" />
          {title}
          <span className="rounded-full bg-coffee-800 px-2 py-0.5 text-xs font-bold text-coffee-300">
            {rows.length}
          </span>
        </h2>
        {headerAction}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-coffee-400">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {visibleRows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-coffee-700/40 bg-coffee-800 px-3 py-2.5 text-sm transition active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-coffee-50">{row.title}</span>
                  {row.subtitle && (
                    <span className="block truncate text-xs text-coffee-400">{row.subtitle}</span>
                  )}
                </span>
                {row.badge && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold",
                      TONE_CLASSES[row.badge.tone],
                    )}
                  >
                    {row.badge.label}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rows.length > initialVisible && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 w-full rounded-full border border-coffee-700 bg-coffee-800 px-3 py-2 text-xs font-semibold text-coffee-200 active:scale-95"
        >
          {expanded ? "Mostra meno" : `Mostra tutte (${rows.length})`}
        </button>
      )}
    </Card>
  );
}
