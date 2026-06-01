import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "dark";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";

const variants: Record<Variant, string> = {
  primary: "bg-arancio text-white shadow-sm hover:bg-arancio-dark",
  ghost: "border border-coffee-200 bg-white text-coffee-700 hover:bg-coffee-50",
  dark: "bg-coffee-900 text-white hover:bg-coffee-700",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-3.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
