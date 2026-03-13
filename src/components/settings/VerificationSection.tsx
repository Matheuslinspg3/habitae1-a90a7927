import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, ShieldX, ShieldAlert, Mail, Phone, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VerificationResult {
  verified: boolean;
  registered_name?: string;
  status?: string;
  similarity?: number;
  creci_completo?: string;
  message: string;
}

const BRAZILIAN_STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

export function VerificationSection() {
  const { user, profile, refreshProfile } = useAuth();
  const [verifyingCreci, setVerifyingCreci] = useState(false);
  const [creciResult, setCreciResult] = useState<VerificationResult | null>(null);
  const [creciState, setCreciState] = useState("SP");
  const [verifyStep, setVerifyStep] = useState("");

  const emailVerified = profile?.email_verified || !!user?.email_confirmed_at;
  const phoneVerified = profile?.phone_verified || false;
  const creciVerified = profile?.creci_verified || false;
  const creciVerifiedName = profile?.creci_verified_name || null;

  const handleVerifyCreci = async () => {
    if (!profile?.creci) {
      toast.error("Informe seu número de CRECI no perfil antes de verificar.");
      return;
    }
    if (!profile?.full_name) {
      toast.error("Informe seu nome completo no perfil antes de verificar.");
      return;
    }

    setVerifyingCreci(true);
    setCreciResult(null);
    setVerifyStep("Enviando consulta...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      setVerifyStep("Consultando registro público (pode levar até 45s)...");

      const response = await supabase.functions.invoke("verify-creci", {
        body: {
          action: "verify-creci",
          creci_number: profile.creci,
          user_name: profile.full_name,
          creci_state: creciState,
        },
      });

      if (response.error) throw response.error;

      const result = response.data as VerificationResult;
      setCreciResult(result);

      if (result.verified) {
        toast.success("CRECI verificado com sucesso!");
        refreshProfile();
      } else {
        toast.error("Verificação do CRECI falhou. Veja os detalhes abaixo.");
      }
    } catch (error: any) {
      toast.error("Erro ao verificar CRECI: " + (error.message || "Tente novamente"));
    } finally {
      setVerifyingCreci(false);
      setVerifyStep("");
    }
  };

  const handleResendEmail = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });
    if (error) {
      toast.error("Erro ao reenviar e-mail de verificação");
    } else {
      toast.success("E-mail de verificação reenviado!");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Verificações de Segurança
        </CardTitle>
        <CardDescription>
          Verifique seus dados para aumentar a confiabilidade do seu perfil
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Verification */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">E-mail</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          {emailVerified ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 gap-1">
              <ShieldCheck className="h-3 w-3" />
              Verificado
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="gap-1">
                <ShieldX className="h-3 w-3" />
                Não verificado
              </Badge>
              <Button size="sm" variant="outline" onClick={handleResendEmail}>
                Reenviar
              </Button>
            </div>
          )}
        </div>

        {/* Phone Verification */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Telefone</p>
              <p className="text-xs text-muted-foreground">
                {profile?.phone || "Não informado"}
              </p>
            </div>
          </div>
          {phoneVerified ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 gap-1">
              <ShieldCheck className="h-3 w-3" />
              Verificado
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <ShieldAlert className="h-3 w-3" />
              Pendente
            </Badge>
          )}
        </div>

        {/* CRECI Verification */}
        <div className="flex flex-col gap-3 p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">CRECI</p>
                <p className="text-xs text-muted-foreground">
                  {profile?.creci || "Não informado"}
                  {creciVerifiedName && (
                    <span className="ml-1 text-green-600 dark:text-green-400">
                      — {creciVerifiedName}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {creciVerified ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 gap-1">
                <ShieldCheck className="h-3 w-3" />
                Verificado
              </Badge>
            ) : null}
          </div>

          {!creciVerified && (
            <div className="flex items-center gap-2">
              <Select value={creciState} onValueChange={setCreciState}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleVerifyCreci}
                disabled={verifyingCreci || !profile?.creci}
                className="flex-1"
              >
                {verifyingCreci ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    {verifyStep}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-1" />
                    Verificar CRECI
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* CRECI verification result */}
        {creciResult && (
          <Alert variant={creciResult.verified ? "default" : "destructive"}>
            <AlertDescription className="text-sm space-y-1">
              <p>{creciResult.message}</p>
              {creciResult.creci_completo && (
                <p className="text-xs text-muted-foreground">
                  Registro: {creciResult.creci_completo}
                </p>
              )}
              {creciResult.similarity !== undefined && !creciResult.verified && (
                <p className="text-xs text-muted-foreground">
                  Similaridade do nome: {creciResult.similarity}%
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
