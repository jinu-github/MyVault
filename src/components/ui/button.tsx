import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils.ts";

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
  outline: "border border-input bg-surface-raised text-foreground hover:bg-secondary",
  danger: "border border-destructive/40 text-destructive hover:bg-destructive/10",
} as const;

const sizes = {
  sm: "h-8 gap-1.5 px-2.5 text-[11px]",
  md: "h-9 gap-2 px-3 text-[12px]",
  icon: "size-8",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({ variant = "default", size = "md", className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
