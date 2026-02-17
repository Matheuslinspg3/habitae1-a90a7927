import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { z } from "zod";
import { getAuthStorageStrategy } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, user, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(() => getAuthStorageStrategy() === "local");

  useEffect(() => {
    if (user && !loading) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      // A-02: Focus first invalid field
      const firstErrorField = result.error.errors[0]?.path[0] as string;
      if (firstErrorField) {
        const el = document.getElementById(`login-${firstErrorField}`);
        el?.focus();
      }
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password, rememberMe);
    setIsLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao entrar",
        description: error.message === "Invalid login credentials"
          ? "Email ou senha incorretos"
          : error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      {/* Vibrant mesh background */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-mesh-vibrant" />

      {/* Colored gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-[25%] -right-[15%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full opacity-[0.08]"
          style={{
            background: "radial-gradient(circle, hsl(215 70% 55%), transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute top-[40%] -left-[20%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, hsl(270 60% 58%), transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -bottom-[15%] right-[20%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] rounded-full opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, hsl(168 50% 42%), transparent 70%)",
            filter: "blur(50px)",
          }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Top bar with logo */}
      <header className="relative z-10 p-6 sm:p-8">
        <HabitaeLogo variant="horizontal" size="md" />
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md space-y-10 page-enter">
          {/* Editorial label + oversized headline */}
          <div className="space-y-4">
            <span className="editorial-label flex items-center gap-2">
              <span className="color-dot" />
              Gestão Imobiliária
            </span>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-foreground">
              Bem-vindo
              <br />
              <span className="text-gradient-vibrant">de volta.</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-sm">
              Entre na sua conta para gerenciar seus imóveis e acompanhar seu funil.
            </p>
          </div>

          {/* Colorful section divider */}
          <hr className="section-divider" />

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="editorial-label-muted">
                Email
              </Label>
              <Input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                className="h-12 rounded-xl bg-muted/40 border-border/50 text-base placeholder:text-muted-foreground/50 focus:bg-card focus:border-primary/40 transition-all duration-300"
              />
              {errors.email && <p id="login-email-error" role="alert" className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="editorial-label-muted">
                Senha
              </Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "login-password-error" : undefined}
                className="h-12 rounded-xl bg-muted/40 border-border/50 text-base placeholder:text-muted-foreground/50 focus:bg-card focus:border-primary/40 transition-all duration-300"
              />
              {errors.password && <p id="login-password-error" role="alert" className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>


            <div className="flex items-center gap-2">
              <Checkbox
                id="login-remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                aria-label="Lembrar-me"
              />
              <Label htmlFor="login-remember-me" className="text-sm text-muted-foreground cursor-pointer">
                Lembrar-me (manter login após fechar a aba)
              </Label>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 rounded-xl text-base font-semibold group glow-primary-hover transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-5 w-5 ml-2 transition-transform duration-300 group-hover:translate-x-1.5" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60 tracking-widest uppercase">
            Habitae — Simplificando o mercado imobiliário
          </p>
        </div>
      </main>
    </div>
  );
}
