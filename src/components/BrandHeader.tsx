import { cn } from "@/lib/cn";

export function BrandHeader({
  action,
  className,
}: {
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-6 flex items-center justify-between bg-coffee-900 px-5 py-4 sm:rounded-2xl",
        className,
      )}
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      <img src="/logo-white.png" alt="Coffee Express" className="h-10 w-auto" />
      {action}
    </header>
  );
}
