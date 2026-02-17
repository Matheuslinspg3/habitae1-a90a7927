import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { ArrowRight, Loader2 } from "lucide-react";

export default function AppAuth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app/home", { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, user_type: "consumer" },
          },
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Algo deu errado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background safe-area-top">
      {/* Vibrant multi-color background */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-mesh-vibrant" />
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, hsl(270 60% 58%), transparent 70%)",
            filter: "blur(50px)",
          }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[50vw] h-[50vw] max-w-[400px] max-h-[400px] rounded-full opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, hsl(168 50% 42%), transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Logo */}
      <header className="relative z-10 p-6">
        <HabitaeLogo variant="horizontal" size="md" />
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm space-y-8 page-enter">
          {/* Editorial label + hero text */}
          <div className="space-y-3">
            <span className="editorial-label-accent flex items-center gap-2">
              <span className="color-dot-accent" />
              {isLogin ? "Acesso" : "Cadastro"}
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground">
              {isLogin ? (
                <>
                  Encontre seu
                  <br />
                  <span className="text-gradient-warm">próximo lar.</span>
                </>
              ) : (
                <>
                  Crie sua
                  <br />
                  <span className="text-gradient-vibrant">conta gratuita.</span>
                </>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isLogin ? "Entre na sua conta para continuar" : "Cadastre-se para explorar imóveis"}
            </p>
          </div>

          <hr className="section-divider" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="editorial-label-muted">Nome</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="rounded-xl bg-muted/40 border-border/50 placeholder:text-muted-foreground/50 focus:bg-card focus:border-primary/40 transition-all duration-300"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="editorial-label-muted">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl bg-muted/40 border-border/50 placeholder:text-muted-foreground/50 focus:bg-card focus:border-primary/40 transition-all duration-300"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="editorial-label-muted">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl bg-muted/40 border-border/50 placeholder:text-muted-foreground/50 focus:bg-card focus:border-primary/40 transition-all duration-300"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-14 rounded-xl text-base font-semibold group glow-primary-hover transition-all duration-300"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Entrar" : "Criar conta"}
                  <ArrowRight className="h-5 w-5 ml-2 transition-transform duration-300 group-hover:translate-x-1.5" />
                </>
              )}
            </Button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-semibold hover:underline underline-offset-4 transition-colors"
            >
              {isLogin ? "Cadastre-se" : "Entrar"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
