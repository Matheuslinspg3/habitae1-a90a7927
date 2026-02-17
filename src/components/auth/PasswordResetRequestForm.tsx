import { FormEvent, useState } from "react";
import { z } from "zod";
import { Mail, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emailSchema = z.string().email("Informe um e-mail válido");

interface PasswordResetRequestFormProps {
  initialEmail?: string;
  redirectPath?: string;
  buttonLabel?: string;
  onSuccess?: (email: string) => void;
  onError?: (message: string) => void;
}

export function PasswordResetRequestForm({
  initialEmail = "",
  redirectPath = "/redefinir-senha",
  buttonLabel = "Enviar link de redefinição",
  onSuccess,
  onError,
}: PasswordResetRequestFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const parsedEmail = emailSchema.safeParse(email.trim());
    if (!parsedEmail.success) {
      setError(parsedEmail.error.errors[0]?.message ?? "E-mail inválido");
      return;
    }

    setSending(true);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
      redirectTo: window.location.origin + redirectPath,
    });
    setSending(false);

    if (requestError) {
      const message = `Erro ao enviar link: ${requestError.message}`;
      setError(message);
      onError?.(requestError.message);
      return;
    }

    onSuccess?.(parsedEmail.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password-reset-email">E-mail</Label>
        <Input
          id="password-reset-email"
          type="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "password-reset-email-error" : undefined}
        />
        {error && (
          <p id="password-reset-email-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={sending}>
        {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
        {buttonLabel}
      </Button>
    </form>
  );
}
