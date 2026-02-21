import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const Auth = React.forwardRef<HTMLDivElement, object>(function Auth(_props, _ref) {
  const navigate = useNavigate();
  const { signIn, user, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

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
      const firstErrorField = result.error.errors[0]?.path[0] as string;
      if (firstErrorField) {
        const el = document.getElementById(`login-${firstErrorField}`);
        el?.focus();
      }
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: window.location.origin + "/auth",
    });
    setSendingReset(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } else {
      toast({
        title: "Link enviado",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      setShowForgotPassword(false);
      setResetEmail("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      {/* Warm mesh background */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-mesh-vibrant" />

      {/* Warm gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-[25%] -right-[15%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, hsl(0 72% 50%), transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute top-[40%] -left-[20%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, hsl(31 100% 48%), transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -bottom-[15%] right-[20%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] rounded-full opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, hsl(40 97% 64%), transparent 70%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md space-y-10 page-enter">
          {/* Centered logo + icon */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center gap-3">
              <HabitaeLogo variant="icon" size="lg" />
              <span className="font-display text-2xl font-bold text-foreground tracking-tight">
                Porta do Corretor
              </span>
            </div>
            <span className="editorial-label-accent flex items-center gap-2">
              <span className="color-dot-accent" />
              Plataforma de Performance
            </span>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-foreground">
              Bem-vindo
              <br />
              <span className="text-gradient-vibrant">de volta.</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-sm">
              Entre na sua conta para gerenciar leads, converter mais e escalar seus resultados.
            </p>
          </div>

          {/* Section divider */}
          <hr className="section-divider" />

          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao login
                </button>
                <h2 className="font-display text-xl font-bold text-foreground">Recuperar senha</h2>
                <p className="text-sm text-muted-foreground">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="editorial-label-muted">
                  Email
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="h-12 bg-muted/40 border-border/50 text-base placeholder:text-muted-foreground/50 focus:bg-card focus:border-accent/40 transition-all duration-300"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                size="lg"
                variant="gold"
                className="w-full h-14 text-base"
                disabled={sendingReset || !resetEmail.trim()}
              >
                {sendingReset ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>
          ) : (
            <>
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
                    className="h-12 bg-muted/40 border-border/50 text-base placeholder:text-muted-foreground/50 focus:bg-card focus:border-accent/40 transition-all duration-300"
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
                    className="h-12 bg-muted/40 border-border/50 text-base placeholder:text-muted-foreground/50 focus:bg-card focus:border-accent/40 transition-all duration-300"
                  />
                  {errors.password && <p id="login-password-error" role="alert" className="text-xs text-destructive mt-1">{errors.password}</p>}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setResetEmail(loginForm.email); }}
                    className="text-sm text-muted-foreground hover:text-accent transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  variant="gold"
                  className="w-full h-14 text-base group glow-primary-hover"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Entrar na plataforma
                      <ArrowRight className="h-5 w-5 ml-2 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60 tracking-widest uppercase">
            Porta do Corretor — Performance e Conversão
          </p>
        </div>
      </main>
    </div>
  );
});
Auth.displayName = "Auth";

export default Auth;
