import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { Loader2, ArrowRight, CheckCircle, XCircle, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
  orgCode: z.string().min(1, "Código da imobiliária é obrigatório"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

interface InviteData {
  id: string;
  role: string;
  organization_id: string;
  status: string;
  expires_at: string;
  email?: string | null;
  org_name?: string;
}

export default function AcceptInvite() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [waitingEmailConfirmation, setWaitingEmailConfirmation] = useState(false);
  const acceptAttempted = useRef(false);

  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", orgCode: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load invite data
  useEffect(() => {
    const loadInvite = async () => {
      if (!id) { setError("Link inválido"); setLoading(false); return; }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        setError("Link de convite inválido");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("organization_invites")
        .select("id, role, organization_id, status, expires_at, email")
        .eq("id", id)
        .maybeSingle();

      if (fetchError || !data) {
        setError("Convite não encontrado ou expirado");
        setLoading(false);
        return;
      }

      if (data.status === "accepted") {
        // If user is logged in and already in this org, redirect
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile?.organization_id === data.organization_id) {
            setAccepted(true);
            setLoading(false);
            setTimeout(() => navigate("/dashboard"), 1500);
            return;
          }
        }
        setError("Este convite já foi utilizado");
        setLoading(false);
        return;
      }

      if (data.status !== "pending") {
        setError("Este convite já foi utilizado");
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("Este convite expirou");
        setLoading(false);
        return;
      }

      // Get org name
      let orgName = "Organização";
      try {
        const { data: nameData } = await supabase
          .rpc("get_org_name_for_invite", { p_invite_id: data.id });
        if (nameData) orgName = nameData as string;
      } catch {}

      setInvite({ ...data, org_name: orgName });
      if (data.email) {
        setForm(prev => ({ ...prev, email: data.email! }));
      }
      setLoading(false);
    };

    if (!authLoading) {
      loadInvite();
    }
  }, [id, authLoading, user]);

  // Auto-accept when user is logged in
  useEffect(() => {
    if (user && invite && !accepted && !isSubmitting && !acceptAttempted.current) {
      acceptAttempted.current = true;
      acceptInvite();
    }
  }, [user, invite]);

  const acceptInvite = async () => {
    if (!invite || !user) return;
    setIsSubmitting(true);

    try {
      // First check if the trigger already handled it (profile already in correct org)
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.organization_id === invite.organization_id) {
        setAccepted(true);
        toast({ title: "Bem-vindo!", description: `Você faz parte de ${invite.org_name}` });
        setTimeout(() => navigate("/dashboard"), 1500);
        return;
      }

      // Call edge function
      const { data, error: fnError } = await supabase.functions.invoke("accept-invite", {
        body: { invite_id: invite.id },
      });

      // Handle "already used" as success (trigger may have handled it)
      if (data?.error && (data.error.includes("já utilizado") || data.error.includes("já pertence"))) {
        // Double-check profile
        const { data: profileCheck } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileCheck?.organization_id === invite.organization_id) {
          setAccepted(true);
          toast({ title: "Bem-vindo!", description: `Você faz parte de ${invite.org_name}` });
          setTimeout(() => navigate("/dashboard"), 1500);
          return;
        }
      }

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setAccepted(true);
      toast({ title: "Bem-vindo!", description: `Você agora faz parte de ${invite.org_name}` });
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      // Final fallback: check if user is already in the org
      try {
        const { data: profileFallback } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileFallback?.organization_id === invite.organization_id) {
          setAccepted(true);
          toast({ title: "Bem-vindo!", description: `Você já faz parte de ${invite.org_name}` });
          setTimeout(() => navigate("/dashboard"), 1500);
          return;
        }
      } catch {}

      toast({ variant: "destructive", title: "Erro", description: err.message || "Erro ao aceitar convite" });
      acceptAttempted.current = false; // Allow retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
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

    // Validate org code
    const { data: codeValid } = await supabase
      .rpc("validate_invite_org_code", { p_org_id: invite.organization_id, p_code: form.orgCode.trim() });

    if (!codeValid) {
      setErrors({ orgCode: "Código da imobiliária incorreto" });
      return;
    }

    setIsSubmitting(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/convite/${invite.id}`,
        data: {
          full_name: form.name,
          account_type: "corretor_individual",
        },
      },
    });

    setIsSubmitting(false);

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        toast({
          variant: "destructive",
          title: "Email já cadastrado",
          description: "Faça login e acesse este link novamente para aceitar o convite.",
        });
      } else {
        toast({ variant: "destructive", title: "Erro ao criar conta", description: signUpError.message });
      }
      return;
    }

    // Show email confirmation screen
    setWaitingEmailConfirmation(true);
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <HabitaeLogo variant="horizontal" size="lg" />
          <Card>
            <CardContent className="pt-6 space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-lg font-medium">{error}</p>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Ir para o login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Waiting for email confirmation
  if (waitingEmailConfirmation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <HabitaeLogo variant="horizontal" size="lg" />
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Mail className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold">Verifique seu email</h2>
              <p className="text-muted-foreground">
                Enviamos um link de confirmação para <span className="font-medium text-foreground">{form.email}</span>.
              </p>
              <p className="text-sm text-muted-foreground">
                Clique no link do email para confirmar sua conta. Após a confirmação, você será redirecionado automaticamente para aceitar o convite.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setWaitingEmailConfirmation(false)}>
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Accepted state
  if (accepted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <HabitaeLogo variant="horizontal" size="lg" />
          <Card>
            <CardContent className="pt-6 space-y-4">
              <CheckCircle className="h-12 w-12 text-primary mx-auto" />
              <p className="text-lg font-medium">Convite aceito!</p>
              <p className="text-muted-foreground">Redirecionando para o painel...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // User logged in - accepting invite
  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <HabitaeLogo variant="horizontal" size="lg" />
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Aceitando convite...</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => {
                acceptAttempted.current = false;
                acceptInvite();
              }}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Signup form
  return (
    <div className="min-h-screen flex flex-col items-center bg-background py-8 px-4 relative overflow-y-auto">
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        <div className="flex justify-center mb-6">
          <HabitaeLogo variant="horizontal" size="lg" />
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold leading-tight mb-2">
            Você foi convidado!
          </h1>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{invite?.org_name}</span> convidou você para se juntar como{" "}
            <span className="font-medium text-foreground">Corretor</span>.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-lg">Criar sua conta</CardTitle>
            <CardDescription className="text-center">
              Preencha seus dados e o código da imobiliária para aceitar o convite
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Nome completo</Label>
                <Input
                  id="invite-name"
                  placeholder="João da Silva"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  readOnly={!!invite?.email}
                  className={invite?.email ? "bg-muted" : ""}
                />
                {invite?.email && (
                  <p className="text-xs text-muted-foreground">Este convite é destinado a este email</p>
                )}
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-org-code">Código da imobiliária</Label>
                <Input
                  id="invite-org-code"
                  placeholder="Ex: ABC123"
                  value={form.orgCode}
                  onChange={(e) => setForm({ ...form, orgCode: e.target.value.toUpperCase() })}
                  className="font-mono tracking-widest uppercase"
                  maxLength={10}
                />
                {errors.orgCode && <p className="text-sm text-destructive">{errors.orgCode}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-password">Senha</Label>
                <Input
                  id="invite-password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-confirm">Confirmar senha</Label>
                <Input
                  id="invite-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>

              <Button type="submit" variant="gold" size="lg" className="w-full group" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Criar conta e aceitar convite
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Já tem uma conta?{" "}
              <a href="/auth" className="text-primary hover:underline">Faça login</a>
              {" "}e acesse este link novamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
