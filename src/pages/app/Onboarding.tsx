import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ShieldCheck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingSlide } from "@/components/app/OnboardingSlide";
import { cn } from "@/lib/utils";

const slides = [
  {
    icon: MapPin,
    title: "Encontre seu lugar",
    description: "Descubra imóveis que combinam com você, perto de onde quer estar.",
  },
  {
    icon: ShieldCheck,
    title: "Imóveis verificados",
    description: "Todos os imóveis são verificados por corretores credenciados. Transparência total.",
  },
  {
    icon: Heart,
    title: "Salve e compare",
    description: "Favorite os imóveis que mais gostou e compare quando quiser.",
  },
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const navigate = useNavigate();

  const finish = () => {
    localStorage.setItem("habitae_onboarding_done", "true");
    navigate("/app/home", { replace: true });
  };

  const next = () => {
    if (current < slides.length - 1) {
      setDirection("left");
      setCurrent(current + 1);
    } else {
      finish();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background safe-area-top page-enter">
      {/* Skip */}
      <div className="flex justify-end p-4">
        <Button variant="ghost" size="sm" onClick={finish} className="text-muted-foreground transition-all duration-200 active:scale-95">
          Pular
        </Button>
      </div>

      {/* Slide */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div key={current} className="page-enter w-full">
          <OnboardingSlide {...slides[current]} />
        </div>
      </div>

      {/* Dots + Button */}
      <div className="flex flex-col items-center gap-6 pb-12 px-8">
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full onboarding-dot",
                i === current ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
        <Button
          onClick={next}
          className="w-full max-w-xs h-12 text-base rounded-xl transition-all duration-200 ease-out-expo active:scale-[0.97]"
        >
          {current === slides.length - 1 ? "Começar" : "Próximo"}
        </Button>
      </div>
    </div>
  );
}