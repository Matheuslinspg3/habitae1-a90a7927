import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useMfaAuth } from "@/hooks/useMfaAuth";
import { useToast } from "@/hooks/use-toast";

export default function MfaEnroll() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { enroll, verifyCode, generateRecoveryCodes } = useMfaAuth();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const factor = await enroll("Authenticator App");
        setFactorId(factor.id);
        setQrCode(factor.totp.qr_code);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Erro ao iniciar MFA", description: error.message });
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [enroll, toast]);

  const handleVerify = async () => {
    if (!factorId) return;

    setLoading(true);
    try {
      await verifyCode(factorId, code);
      const generatedCodes = await generateRecoveryCodes();
      setRecoveryCodes(generatedCodes);
      toast({ title: "MFA ativado", description: "Guarde os códigos de recuperação em local seguro." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Falha na verificação", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Ativar autenticação em duas etapas</CardTitle>
          <CardDescription>Escaneie o QR Code no app autenticador e confirme com o código TOTP.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrCode && <img src={qrCode} alt="QR Code MFA" className="h-48 w-48 mx-auto" />}
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Código do autenticador</Label>
            <Input id="mfa-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
          </div>
          <Button className="w-full" onClick={handleVerify} disabled={loading || code.length < 6}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar ativação"}
          </Button>

          {recoveryCodes.length > 0 && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Códigos de recuperação</p>
              <ul className="grid grid-cols-2 gap-1 text-xs">
                {recoveryCodes.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <Button variant="secondary" className="w-full" onClick={() => navigate("/dashboard")}>Continuar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
