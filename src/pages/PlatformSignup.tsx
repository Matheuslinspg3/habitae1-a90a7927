import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Sparkles, ArrowRight, Building2, CheckCircle2, User } from "lucide-react";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { PillBadge } from "@/components/ui/pill-badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const signupSchema = z.object({
  full_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  company_name: z.string().min(2, "Nome obrigatório"),
  phone: z.string().optional(),
  account_type: z.enum(["imobiliaria", "corretor_individual"]),
});

export default function PlatformSignup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteName, setInviteName] = useState<string | null>(null);
  const [emailLocked, setEmailLocked] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    company_name: "",
    phone: "",
    account_type: "imobiliaria" as "imobiliaria" | "corretor_individual",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    const checkInvite = async () => {
      const { data, error } = await supabase.functions.invoke("platform-invite-validate", {
        body: { invite_id: id },
      });

      if (error || !data?.valid || !data?.invite) {
        setInviteValid(false);
        return;
      }

      setInviteName(data.invite.name);
      if (data.invite.invite_email) {
        setForm(prev => ({ ...prev, email: data.invite.invite_email as string }));
        setEmailLocked(true);
      }
      setInviteValid(true);
    };
    checkInvite();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = signupSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("platform-signup", {
        body: { invite_id: id, ...form },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro ao cadastrar");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      toast.error("Erro de conexão");
    }
    setIsLoading(false);
  };

  if (inviteValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!inviteValid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <HabitaeLogo variant="horizontal" size="lg" />
        <Card className="mt-8 max-w-md w-full">
          <CardContent className="py-8 text-center">
            <p className="text-lg font-medium text-destructive">Convite inválido ou expirado</p>
            <p className="text-muted-foreground mt-2">
              Solicite um novo link de cadastro ao administrador.
            </p>
            <Button className="mt-6" onClick={() => navigate("/auth")}>
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <HabitaeLogo variant="horizontal" size="lg" />
        <Card className="mt-8 max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <p className="text-xl font-bold">Cadastro realizado!</p>
            <p className="text-muted-foreground">
              Sua imobiliária foi criada com sucesso. Você tem <strong>7 dias gratuitos</strong> para explorar todas as funcionalidades.
            </p>
            <Button variant="gold" size="lg" className="w-full" onClick={() => navigate("/auth")}>
              Fazer Login
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-background py-8 px-4 relative overflow-y-auto">
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        <div className="flex justify-center mb-6">
          <PillBadge icon={<Sparkles className="h-4 w-4" />} className="animate-float">
            7 dias gratuitos para testar
          </PillBadge>
        </div>

        <div className="flex justify-center mb-6">
          <HabitaeLogo variant="horizontal" size="lg" />
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold leading-tight mb-2">
            Cadastre-se na plataforma
          </h1>
          {inviteName && (
            <p className="text-muted-foreground">
              Convite: <span className="font-medium">{inviteName}</span>
            </p>
          )}
        </div>

        <Card className="glass-card border-white/10 shadow-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-lg flex items-center justify-center gap-2">
              <Building2 className="h-5 w-5" />
              Criar Conta
            </CardTitle>
            <CardDescription className="text-center">
              Preencha os dados para começar seu período de teste
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account type selector */}
              <div className="space-y-2">
                <Label>Tipo de conta *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, account_type: "imobiliaria" })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      form.account_type === "imobiliaria"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/50 hover:bg-accent"
                    }`}
                  >
                    <Building2 className="h-6 w-6" />
                    <span className="text-sm font-medium">Imobiliária</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, account_type: "corretor_individual" })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      form.account_type === "corretor_individual"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/50 hover:bg-accent"
                    }`}
                  >
                    <User className="h-6 w-6" />
                    <span className="text-sm font-medium">Corretor</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">
                  {form.account_type === "imobiliaria" ? "Nome da Imobiliária *" : "Seu Nome Profissional *"}
                </Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder={form.account_type === "imobiliaria" ? "Imobiliária Exemplo" : "João Silva Imóveis"}
                />
                {errors.company_name && <p className="text-sm text-destructive">{errors.company_name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Seu nome"
                />
                {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="seu@email.com"
                  readOnly={emailLocked}
                  className={emailLocked ? "bg-muted" : ""}
                />
                {emailLocked && (
                  <p className="text-xs text-muted-foreground">Este convite é destinado a este email</p>
                )}
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" variant="gold" size="lg" className="w-full group" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Criar Conta Gratuita
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem uma conta?{" "}
          <a href="/auth" className="text-primary hover:underline font-medium">
            Fazer login
          </a>
        </p>
      </div>
    </div>
  );
}
