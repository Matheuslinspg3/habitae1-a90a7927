import React from "react";
import { cn } from "@/lib/utils";
import portaLogo from "@/assets/porta-logo.png";
import portaIcon from "@/assets/porta-icon.png";

interface PortaLogoProps {
  variant?: "horizontal" | "icon";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: { img: "h-8", text: "text-lg", subtitle: "text-[10px]" },
  md: { img: "h-10", text: "text-xl", subtitle: "text-xs" },
  lg: { img: "h-12", text: "text-2xl", subtitle: "text-sm" },
};

export const HabitaeLogo = React.forwardRef<HTMLDivElement, PortaLogoProps>(
  ({ variant = "horizontal", size = "md", className }, ref) => {
    const sizes = sizeClasses[size];

    if (variant === "icon") {
      return (
        <div className={cn("flex items-center justify-center", className)} ref={ref}>
          <img src={portaIcon} alt="Porta do Corretor" className={cn(sizes.img, "w-auto object-contain")} />
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-2.5", className)} ref={ref}>
        <img src={portaLogo} alt="Porta do Corretor" className={cn(sizes.img, "w-auto object-contain")} />
      </div>
    );
  }
);
HabitaeLogo.displayName = "HabitaeLogo";
