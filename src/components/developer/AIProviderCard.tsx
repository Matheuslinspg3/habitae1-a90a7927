import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Bot, Save, Loader2, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AIConfig {
  text_provider: string;
  text_openai_model: string;
  image_provider: string;
  lovable_fallback_enabled: boolean;
}

const DEFAULT_CONFIG: AIConfig = {
  text_provider: "lovable",
  text_openai_model: "gpt-4o",
  image_provider: "lovable",
  lovable_fallback_enabled: true,
};

const TEXT_PROVIDERS = [
  { value: "lovable", label: "Lovable AI (Gemini)", description: "Integrado, sem chave necessária", keyName: "" },
  { value: "openai", label: "OpenAI (GPT-4o)", description: "Melhor qualidade geral", keyName: "AI_OPENAI_KEY", keyUrl: "https://platform.openai.com/api-keys" },
  { value: "gemini", label: "Google Gemini", description: "Rápido e econômico", keyName: "AI_GEMINI_KEY", keyUrl: "https://aistudio.google.com/apikey" },
  { value: "anthropic", label: "Anthropic (Claude)", description: "Tom persuasivo e natural", keyName: "AI_ANTHROPIC_KEY", keyUrl: "https://console.anthropic.com/settings/keys" },
  { value: "groq", label: "Groq (Llama 3)", description: "Ultra rápido, tier gratuito", keyName: "AI_GROQ_KEY", keyUrl: "https://console.groq.com/keys" },
];

const IMAGE_PROVIDERS = [
  { value: "lovable", label: "Lovable AI (Gemini)", description: "Integrado, sem chave necessária", keyName: "" },
  { value: "openai", label: "DALL-E 3 (OpenAI)", description: "Alta qualidade, fotorrealista", keyName: "AI_OPENAI_KEY", keyUrl: "https://platform.openai.com/api-keys" },
  { value: "stability", label: "Stability AI (SDXL)", description: "Stable Diffusion via API", keyName: "AI_STABILITY_KEY", keyUrl: "https://platform.stability.ai/account/keys" },
  { value: "leonardo", label: "Leonardo AI", description: "Especializado em produto", keyName: "AI_LEONARDO_KEY", keyUrl: "https://app.leonardo.ai/settings" },
  { value: "flux", label: "Flux (BFL)", description: "Qualidade premium", keyName: "AI_FLUX_KEY", keyUrl: "https://api.bfl.ml/" },
];

export function AIProviderCard() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_provider_config")
        .select("*")
        .eq("id", "singleton")
        .single();
      if (error) throw error;
      if (data) {
        const d = data as any;
        setConfig({
          text_provider: d.text_provider || "lovable",
          text_openai_model: d.text_openai_model || "gpt-4o",
          image_provider: d.image_provider || "lovable",
          lovable_fallback_enabled: d.lovable_fallback_enabled ?? true,
        });
      }
    } catch (err) {
      console.error("Erro ao carregar config de IA:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ai_provider_config")
        .upsert({
          id: "singleton",
          ...config,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        } as any);
      if (error) throw error;
      toast.success("Configuração de IA salva com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar config:", err);
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof AIConfig, value: string | boolean) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const textProvider = TEXT_PROVIDERS.find(p => p.value === config.text_provider);
  const imageProvider = IMAGE_PROVIDERS.find(p => p.value === config.image_provider);

  // Collect required secrets
  const requiredSecrets = new Set<{ name: string; url: string; label: string }>();
  if (textProvider?.keyName) requiredSecrets.add({ name: textProvider.keyName, url: textProvider.keyUrl!, label: textProvider.label });
  if (imageProvider?.keyName && imageProvider.keyName !== textProvider?.keyName) {
    requiredSecrets.add({ name: imageProvider.keyName, url: imageProvider.keyUrl!, label: imageProvider.label });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Provedores de IA
          <Badge variant="outline" className="text-xs ml-auto">
            Texto: {textProvider?.label}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Imagem: {imageProvider?.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* FALLBACK TOGGLE */}
        <div className="flex items-center justify-between rounded-lg border p-3 bg-primary/5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Lovable AI como Fallback</p>
              <p className="text-xs text-muted-foreground">
                Se o provedor principal falhar, usar Lovable AI automaticamente
              </p>
            </div>
          </div>
          <Switch
            checked={config.lovable_fallback_enabled}
            onCheckedChange={(v) => update("lovable_fallback_enabled", v)}
          />
        </div>

        {!config.lovable_fallback_enabled && config.text_provider !== "lovable" && config.image_provider !== "lovable" && (
          <Alert className="border-yellow-500/30 bg-yellow-500/5">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-xs">
              Sem fallback ativo. Se o provedor principal falhar, a geração de IA não funcionará.
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* TEXT PROVIDER */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Geração de Texto (Anúncios)</h3>
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={config.text_provider} onValueChange={(v) => update("text_provider", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEXT_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex flex-col">
                      <span>{p.label}</span>
                      <span className="text-xs text-muted-foreground">{p.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.text_provider === "openai" && (
            <div className="space-y-1">
              <Label className="text-xs">Modelo</Label>
              <Select value={config.text_openai_model} onValueChange={(v) => update("text_openai_model", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Econômico)</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {config.text_provider === "lovable" && (
            <p className="text-xs text-muted-foreground">
              Lovable AI (Gemini) será usado diretamente. Nenhuma configuração necessária.
            </p>
          )}
        </div>

        <Separator />

        {/* IMAGE PROVIDER */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Geração de Imagem</h3>
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={config.image_provider} onValueChange={(v) => update("image_provider", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMAGE_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex flex-col">
                      <span>{p.label}</span>
                      <span className="text-xs text-muted-foreground">{p.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.image_provider === "lovable" && (
            <p className="text-xs text-muted-foreground">
              Lovable AI será usado para gerar imagens. Nenhuma configuração necessária.
            </p>
          )}
        </div>

        {/* REQUIRED SECRETS INFO */}
        {requiredSecrets.size > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Chaves necessárias (Secrets)</h3>
              <p className="text-xs text-muted-foreground">
                As chaves de API são armazenadas como secrets no backend. Configure-as no painel de secrets.
              </p>
              <div className="space-y-1.5">
                {Array.from(requiredSecrets).map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded border p-2 text-xs">
                    <div>
                      <span className="font-mono font-medium">{s.name}</span>
                      <span className="text-muted-foreground ml-2">— {s.label}</span>
                    </div>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      Obter chave <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {config.lovable_fallback_enabled
              ? "✅ Fallback Lovable AI ativo"
              : "⚠️ Fallback desativado"}
          </p>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
