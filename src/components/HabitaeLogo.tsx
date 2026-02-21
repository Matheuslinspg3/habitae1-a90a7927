import React from "react";
import { cn } from "@/lib/utils";

interface PortaLogoProps {
  variant?: "horizontal" | "icon";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: {
    container: "w-8 h-8",
    text: "text-lg",
    subtitle: "text-[10px]",
  },
  md: {
    container: "w-10 h-10",
    text: "text-xl",
    subtitle: "text-xs",
  },
  lg: {
    container: "w-12 h-12",
    text: "text-2xl",
    subtitle: "text-sm",
  },
};

const isCarnival = new Date().getMonth() === 1;

const LogoMark = React.forwardRef<HTMLDivElement, { size?: "sm" | "md" | "lg" }>(
  ({ size = "md" }, ref) => {
    const sizes = sizeClasses[size];
    return (
      <div className="relative" ref={ref}>
        <div 
          className={cn(
            "flex items-center justify-center rounded-xl bg-primary shadow-sm",
            sizes.container
          )}
        >
          {/* Stylized "P" door icon */}
          <svg viewBox="0 0 24 24" fill="none" className="w-[55%] h-[55%]">
            <rect x="4" y="3" width="16" height="18" rx="2" stroke="hsl(0 0% 100%)" strokeWidth="2" fill="none" />
            <circle cx="16" cy="12" r="1.5" fill="hsl(0 0% 100%)" />
            <path d="M4 8h16" stroke="hsl(0 0% 100%)" strokeWidth="1.5" />
          </svg>
        </div>
        {isCarnival && (
          <span className="absolute -top-1.5 -right-1.5 text-xs carnival-samba-pulse" aria-hidden="true">
            🎭
          </span>
        )}
      </div>
    );
  }
);
LogoMark.displayName = "LogoMark";

export const HabitaeLogo = React.forwardRef<HTMLDivElement, PortaLogoProps>(
  ({ variant = "horizontal", size = "md", className }, ref) => {
    const sizes = sizeClasses[size];

    if (variant === "icon") {
      return (
        <div className={cn("flex items-center justify-center", className)} ref={ref}>
          <LogoMark size={size} />
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-2.5", className)} ref={ref}>
        <LogoMark size={size} />
        <div className="flex flex-col">
          <span className={cn("font-display font-bold text-foreground tracking-tight leading-tight", sizes.text)}>
            Porta<span className="text-primary">.</span>
          </span>
          <span className={cn("text-muted-foreground leading-tight font-medium", sizes.subtitle)}>
            do Corretor
          </span>
        </div>
      </div>
    );
  }
);
HabitaeLogo.displayName = "HabitaeLogo";
