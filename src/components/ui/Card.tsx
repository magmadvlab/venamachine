import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-coffee-700/40 bg-coffee-900 p-4 shadow-sm shadow-black/30 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
