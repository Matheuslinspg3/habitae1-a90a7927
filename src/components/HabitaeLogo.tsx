import { cn } from "@/lib/utils";

interface HabitaeLogoProps {
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

function LogoMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = sizeClasses[size];
  return (
    <div className="relative">
      <div 
        className={cn(
          "flex items-center justify-center rounded-2xl bg-primary shadow-sm",
          sizes.container
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-[55%] h-[55%]">
          <path 
            d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" 
            stroke="hsl(0 0% 100%)" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="none"
          />
          <path 
            d="M9 22V12h6v10" 
            stroke="hsl(0 0% 100%)" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
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

export function HabitaeLogo({ 
  variant = "horizontal", 
  size = "md",
  className 
}: HabitaeLogoProps) {
  const sizes = sizeClasses[size];

  if (variant === "icon") {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <LogoMark size={size} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <div className="flex flex-col">
        <span className={cn("font-display font-bold text-foreground tracking-tight", sizes.text)}>
          Habitae
        </span>
        <span className={cn("text-muted-foreground leading-tight font-medium", sizes.subtitle)}>
          Gestão Imobiliária
        </span>
      </div>
    </div>
  );
}
