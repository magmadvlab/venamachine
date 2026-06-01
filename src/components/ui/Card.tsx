import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm shadow-coffee-900/5 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
