import { Link } from "react-router-dom";
import { FlaskConical, Sparkles, ArrowRight, AlertTriangle, Bot, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PillBadge } from "@/components/ui/pill-badge";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { useDemo } from "@/contexts/DemoContext";

export default function Demo() {
  const { startDemo } = useDemo();
  const [copied, setCopied] = useState(false);

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText("GET /api/demo/access");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />
      
      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: "-3s" }} />

      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen">
        {/* Pill badge */}
        <PillBadge variant="warning" className="mb-8">
          <FlaskConical className="h-4 w-4" />
          Ambiente de Demonstração
        </PillBadge>

        {/* Logo */}
        <div className="mb-6">
          <HabitaeLogo size="lg" variant="icon" />
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-center mb-4 tracking-tight">
          Explore o sistema
          <br />
          <span className="text-gradient-gold">sem compromisso</span>
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground text-lg md:text-xl text-center max-w-xl mb-10">
          Experimente todas as funcionalidades da plataforma Habitae sem necessidade de cadastro.
        </p>

        {/* Main Card */}
        <Card className="glass-card border-amber-500/20 w-full max-w-lg mb-8">
          <CardHeader className="flex flex-row items-start gap-3 pb-4">
            <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
            <div>
              <CardTitle className="text-xl">Este é um ambiente de demonstração</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>Dados <strong className="text-foreground">NÃO</strong> serão salvos permanentemente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>Ideal para avaliação e testes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>Sem necessidade de cadastro</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>Todas as funcionalidades disponíveis</span>
              </li>
            </ul>

            <Button 
              variant="gold" 
              size="xl" 
              className="group w-full"
              onClick={startDemo}
            >
              <Sparkles className="h-5 w-5" />
              Acessar Demo
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>

            <div className="text-center pt-2">
              <span className="text-sm text-muted-foreground">Ou crie uma conta real: </span>
              <Link 
                to="/auth" 
                className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1"
              >
                Criar conta gratuita
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* API Access Card */}
        <Card className="glass-card w-full max-w-lg">
          <CardHeader className="flex flex-row items-center gap-3 pb-4">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">Acesso para IAs e Integrações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
              <div className="text-muted-foreground mb-2">Endpoint:</div>
              <code className="text-foreground">GET /api/demo/access</code>
              <div className="text-muted-foreground mt-4 mb-2">Response:</div>
              <pre className="text-xs text-foreground/80">
{`{
  "token": "demo-xxx",
  "expires": "1h"
}`}
              </pre>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyEndpoint}
              className="w-full"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar endpoint
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
