import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMfaAuth } from "@/hooks/useMfaAuth";

export default function MfaVerify() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { listFactors, verifyCode, recoverWithCode, isVerified } = useMfaAuth();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadFactor = async () => {
      try {
        const factors = await listFactors();
        const activeFactor = factors.totp.find((factor) => factor.status === "verified");
        if (!activeFactor) {
          navigate("/auth/mfa/enroll", { replace: true });
          return;
        }
        setFactorId(activeFactor.id);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Erro ao carregar MFA", description: error.message });
      }
    };
    void loadFactor();
  }, [listFactors, navigate, toast]);

  useEffect(() => {
    if (isVerified) {
      navigate("/dashboard", { replace: true });
    }
  }, [isVerified, navigate]);

  const handleVerify = async () => {
    if (!factorId) return;

    setLoading(true);
    try {
      await verifyCode(factorId, code);
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Código inválido", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async () => {
    setLoading(true);
    try {
      await recoverWithCode(recoveryCode);
      toast({ title: "Acesso recuperado", description: "Faça o re-enrollment do autenticador em seguida." });
      navigate("/auth/mfa/enroll", { replace: true });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Falha na recuperação", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verificação MFA</CardTitle>
          <CardDescription>Informe o código do autenticador para concluir o login.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="totp">Código TOTP</Label>
            <Input id="totp" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
            <Button className="w-full" onClick={handleVerify} disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar código"}
            </Button>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label htmlFor="recovery">Ou use um recovery code</Label>
            <Input id="recovery" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())} placeholder="ABCD-EFGH-IJKL" />
            <Button variant="secondary" className="w-full" onClick={handleRecovery} disabled={loading || recoveryCode.length < 8}>
              Usar recovery code
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
