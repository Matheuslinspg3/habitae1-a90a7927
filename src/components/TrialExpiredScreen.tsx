import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, LogOut } from "lucide-react";

export function TrialExpiredScreen() {
  const { signOut, trialInfo } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <HabitaeLogo variant="horizontal" size="lg" />
      <Card className="mt-8 max-w-md w-full">
        <CardContent className="py-8 text-center space-y-4">
          <Clock className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Período de teste encerrado</h2>
          <p className="text-muted-foreground">
            Seu período gratuito de 7 dias expirou. Entre em contato com o administrador para continuar utilizando a plataforma.
          </p>
          <div className="pt-4">
            <Button variant="outline" onClick={() => signOut()} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
