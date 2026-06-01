import Link from "next/link";
import { cn } from "@/lib/cn";

export function Fab({
  href,
  label,
  children,
  className,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "fixed bottom-6 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-arancio text-white shadow-lg shadow-arancio/30 transition active:scale-95 hover:bg-arancio-dark",
        className,
      )}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {children}
    </Link>
  );
}
