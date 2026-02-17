import { useState } from "react";
import { Link } from "react-router-dom";

import { HabitaeLogo } from "@/components/HabitaeLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";

export default function ForgotPassword() {
  const [sentToEmail, setSentToEmail] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <HabitaeLogo variant="horizontal" size="md" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Esqueci a senha</CardTitle>
            <CardDescription>
              Informe seu e-mail para receber um link seguro de redefinição.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sentToEmail ? (
              <div className="rounded-md border p-3 text-sm bg-muted">
                Enviamos um link de redefinição para <strong>{sentToEmail}</strong>. Verifique também sua caixa de spam.
              </div>
            ) : null}

            <PasswordResetRequestForm
              onSuccess={(email) => setSentToEmail(email)}
              onError={() => setSentToEmail("")}
            />

            <p className="text-sm text-muted-foreground text-center">
              Lembrou a senha?{" "}
              <Link to="/auth" className="text-primary underline-offset-4 hover:underline">
                Voltar para login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
