import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function WelcomeHeader() {
  const { profile } = useAuth();
  const now = new Date();
  const hour = now.getHours();

  const isCarnival = now.getMonth() === 1;
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = profile?.full_name?.split(" ")[0] || "";
  const dateStr = format(now, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-3 page-enter">
      <span className="editorial-label flex items-center gap-2">
        <span className="color-dot-accent" />
        {isCarnival ? `Carnaval 2026 🎉` : "Dashboard"}
      </span>
      <p className="editorial-label-muted capitalize" style={{ animationDelay: "50ms" }}>
        {dateStr}
      </p>
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display leading-[1.05] tracking-tight text-foreground">
        {isCarnival && "🎭 "}{greeting}
        {firstName && (
          <>
            ,<br className="sm:hidden" />{" "}
            <span className="text-gradient-vibrant">{firstName}.</span>
          </>
        )}
      </h1>
    </div>
  );
}
