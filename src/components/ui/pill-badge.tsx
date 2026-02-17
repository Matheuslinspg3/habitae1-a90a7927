import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const pillBadgeVariants = cva(
  "inline-flex items-center gap-2 rounded-full text-sm font-medium backdrop-blur-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border border-primary/20",
        secondary: "bg-secondary/80 text-secondary-foreground border border-secondary",
        muted: "bg-muted/80 text-muted-foreground border border-border",
        success: "bg-success/10 text-success border border-success/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        glass: "bg-white/10 text-foreground border border-white/20",
      },
      size: {
        sm: "px-3 py-1 text-xs",
        default: "px-4 py-1.5 text-sm",
        lg: "px-5 py-2 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface PillBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pillBadgeVariants> {
  icon?: React.ReactNode;
}

const PillBadge = React.forwardRef<HTMLDivElement, PillBadgeProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(pillBadgeVariants({ variant, size, className }))}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </div>
    );
  }
);
PillBadge.displayName = "PillBadge";

export { PillBadge, pillBadgeVariants };
