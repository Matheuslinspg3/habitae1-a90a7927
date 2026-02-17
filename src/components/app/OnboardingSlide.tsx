import { type LucideIcon } from "lucide-react";

interface OnboardingSlideProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accentColor?: string;
}

export function OnboardingSlide({ icon: Icon, title, description }: OnboardingSlideProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-12 min-h-[55vh]">
      <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center mb-8 scale-pop">
        <Icon className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-3 font-display page-enter" style={{ animationDelay: "100ms" }}>
        {title}
      </h2>
      <p className="text-muted-foreground text-base leading-relaxed max-w-[280px] page-enter" style={{ animationDelay: "200ms" }}>
        {description}
      </p>
    </div>
  );
}