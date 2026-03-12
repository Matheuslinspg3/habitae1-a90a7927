import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Bot, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AIConfig {
  text_provider: string;
  text_ollama_url: string;
  text_ollama_model: string;
  text_openai_key: string;
  text_openai_model: string;
  text_custom_url: string;
  text_custom_key: string;
  text_custom_model: string;
  image_provider: string;
  image_sd_url: string;
  image_openai_key: string;
  image_custom_url: string;
  image_custom_key: string;
}

const DEFAULT_CONFIG: AIConfig = {
  text_provider: "lovable",
  text_ollama_url: "http://localhost:11434",
  text_ollama_model: "llama3",
  text_openai_key: "",
  text_openai_model: "gpt-4o-mini",
  text_custom_url: "",
  text_custom_key: "",
  text_custom_model: "",
  image_provider: "lovable",
  image_sd_url: "",
  image_openai_key: "",
  image_custom_url: "",
  image_custom_key: "",
};

const TEXT_PROVIDERS = [
  { value: "ollama", label: "Ollama (Local)", description: "Gratuito, roda local na VPS" },
  { value: "openai", label: "OpenAI", description: "API paga da OpenAI" },
  { value: "custom", label: "API Customizada", description: "Qualquer API compatível com OpenAI" },
  { value: "lovable", label: "Lovable AI (Fallback)", description: "Usado apenas se nenhum outro estiver configurado" },
];

const IMAGE_PROVIDERS = [
  { value: "stable_diffusion", label: "Stable Diffusion (Local)", description: "Gratuito, roda na VPS" },
  { value: "openai", label: "DALL-E (OpenAI)", description: "API paga da OpenAI" },
  { value: "custom", label: "API Customizada", description: "Qualquer API de geração de imagem" },
  { value: "lovable", label: "Lovable AI (Fallback)", description: "Usado apenas se nenhum outro estiver configurado" },
];

function MaskedInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AIProviderCard() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_provider_config")
        .select("*")
        .eq("id", "singleton")
        .single();

      if (error) throw error;
      if (data) {
        setConfig({
          text_provider: data.text_provider || "lovable",
          text_ollama_url: data.text_ollama_url || "http://localhost:11434",
          text_ollama_model: data.text_ollama_model || "llama3",
          text_openai_key: data.text_openai_key || "",
          text_openai_model: data.text_openai_model || "gpt-4o-mini",
          text_custom_url: data.text_custom_url || "",
          text_custom_key: data.text_custom_key || "",
          text_custom_model: data.text_custom_model || "",
          image_provider: data.image_provider || "lovable",
          image_sd_url: data.image_sd_url || "",
          image_openai_key: data.image_openai_key || "",
          image_custom_url: data.image_custom_url || "",
          image_custom_key: data.image_custom_key || "",
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
        });

      if (error) throw error;
      toast.success("Configuração de IA salva com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar config:", err);
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof AIConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

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
            Texto: {TEXT_PROVIDERS.find((p) => p.value === config.text_provider)?.label}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Imagem: {IMAGE_PROVIDERS.find((p) => p.value === config.image_provider)?.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* TEXT PROVIDER */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Geração de Texto</h3>
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={config.text_provider} onValueChange={(v) => update("text_provider", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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

          {config.text_provider === "ollama" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">URL do Ollama</Label>
                <Input
                  value={config.text_ollama_url}
                  onChange={(e) => update("text_ollama_url", e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modelo</Label>
                <Input
                  value={config.text_ollama_model}
                  onChange={(e) => update("text_ollama_model", e.target.value)}
                  placeholder="llama3"
                />
              </div>
            </div>
          )}

          {config.text_provider === "openai" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">API Key</Label>
                <MaskedInput
                  value={config.text_openai_key}
                  onChange={(v) => update("text_openai_key", v)}
                  placeholder="sk-..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modelo</Label>
                <Input
                  value={config.text_openai_model}
                  onChange={(e) => update("text_openai_model", e.target.value)}
                  placeholder="gpt-4o-mini"
                />
              </div>
            </div>
          )}

          {config.text_provider === "custom" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">URL da API (compatível OpenAI)</Label>
                <Input
                  value={config.text_custom_url}
                  onChange={(e) => update("text_custom_url", e.target.value)}
                  placeholder="https://api.exemplo.com/v1/chat/completions"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">API Key</Label>
                  <MaskedInput
                    value={config.text_custom_key}
                    onChange={(v) => update("text_custom_key", v)}
                    placeholder="sua-chave"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Modelo</Label>
                  <Input
                    value={config.text_custom_model}
                    onChange={(e) => update("text_custom_model", e.target.value)}
                    placeholder="modelo"
                  />
                </div>
              </div>
            </div>
          )}

          {config.text_provider === "lovable" && (
            <p className="text-xs text-muted-foreground">
              Lovable AI será usado diretamente. Nenhuma configuração necessária.
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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

          {config.image_provider === "stable_diffusion" && (
            <div className="space-y-1">
              <Label className="text-xs">URL do Stable Diffusion (Automatic1111)</Label>
              <Input
                value={config.image_sd_url}
                onChange={(e) => update("image_sd_url", e.target.value)}
                placeholder="http://seu-ip:7860"
              />
            </div>
          )}

          {config.image_provider === "openai" && (
            <div className="space-y-1">
              <Label className="text-xs">API Key do OpenAI (DALL-E)</Label>
              <MaskedInput
                value={config.image_openai_key}
                onChange={(v) => update("image_openai_key", v)}
                placeholder="sk-..."
              />
            </div>
          )}

          {config.image_provider === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">URL da API</Label>
                <Input
                  value={config.image_custom_url}
                  onChange={(e) => update("image_custom_url", e.target.value)}
                  placeholder="https://api.exemplo.com/v1/images"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">API Key</Label>
                <MaskedInput
                  value={config.image_custom_key}
                  onChange={(v) => update("image_custom_key", v)}
                  placeholder="sua-chave"
                />
              </div>
            </div>
          )}

          {config.image_provider === "lovable" && (
            <p className="text-xs text-muted-foreground">
              Lovable AI será usado para gerar imagens. Nenhuma configuração necessária.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Se o provedor selecionado falhar, o sistema usa Lovable AI como fallback automático.
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
