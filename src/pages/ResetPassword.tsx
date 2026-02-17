import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, Mail } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";

const passwordSchema = z
  .object({
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirme a nova senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState<boolean | null>(null);

  const recoveryErrorMessage = useMemo(() => {
    if (!requestError) return null;

    const normalizedError = requestError.toLowerCase();
    if (
      normalizedError.includes("expired") ||
      normalizedError.includes("invalid") ||
      normalizedError.includes("otp") ||
      normalizedError.includes("token")
    ) {
      return "Este link de recuperação expirou ou é inválido. Solicite um novo e-mail de redefinição.";
    }

    return "Não foi possível validar o link de recuperação. Solicite um novo e-mail de redefinição.";
  }, [requestError]);

  useEffect(() => {
    const parseHashParams = () => {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;

      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");
      const errorDescription = hashParams.get("error_description") || hashParams.get("error");

      return { accessToken, refreshToken, type, errorDescription };
    };

    const ensureRecoverySession = async () => {
      const { accessToken, refreshToken, type, errorDescription } = parseHashParams();

      if (errorDescription) {
        setRequestError(errorDescription);
        setIsRecoverySession(false);
        return;
      }

      if (type === "recovery" && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setRequestError(error.message);
          setIsRecoverySession(false);
          return;
        }

        setIsRecoverySession(true);
        window.history.replaceState(null, "", "/redefinir-senha");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setIsRecoverySession(Boolean(session));
    };

    ensureRecoverySession();
  }, []);

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormErrors({});
    setRequestSuccess(false);

    const parsed = passwordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      parsed.error.errors.forEach((issue) => {
        if (issue.path[0]) {
          nextErrors[issue.path[0] as string] = issue.message;
        }
      });
      setFormErrors(nextErrors);
      return;
    }

    setIsUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setIsUpdating(false);

    if (error) {
      setRequestError(error.message);
      return;
    }

    setRequestError(null);
    setRequestSuccess(true);
    setPassword("");
    setConfirmPassword("");

    setTimeout(() => {
      navigate("/auth");
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>
            Defina uma nova senha para voltar a acessar sua conta.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {requestSuccess ? (
            <div className="rounded-md border p-3 text-sm bg-muted">
              Senha atualizada com sucesso! Redirecionando para o login...
            </div>
          ) : null}

          {isRecoverySession === false ? (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {recoveryErrorMessage ?? "Sessão de recuperação inválida."}
              </div>

              <PasswordResetRequestForm buttonLabel="Reenviar link de redefinição" />

              <p className="text-sm text-muted-foreground text-center">
                <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
                  Voltar para login
                </Link>
              </p>
            </div>
          ) : null}

          {isRecoverySession === true ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {requestError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {requestError}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="reset-password">Nova senha</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={!!formErrors.password}
                />
                {formErrors.password ? <p className="text-xs text-destructive">{formErrors.password}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reset-confirm-password">Confirmar nova senha</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  aria-invalid={!!formErrors.confirmPassword}
                />
                {formErrors.confirmPassword ? <p className="text-xs text-destructive">{formErrors.confirmPassword}</p> : null}
              </div>

              <Button type="submit" className="w-full" disabled={isUpdating}>
                {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                Salvar nova senha
              </Button>
            </form>
          ) : null}

          {isRecoverySession === null ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
