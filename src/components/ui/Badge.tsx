import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "brand-green" | "brand-orange" | "muted";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-gray-100 text-gray-700",
  "brand-green": "bg-brand-green/10 text-brand-green",
  "brand-orange": "bg-brand-orange/10 text-brand-orange",
  muted: "bg-muted text-muted-foreground",
};

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
