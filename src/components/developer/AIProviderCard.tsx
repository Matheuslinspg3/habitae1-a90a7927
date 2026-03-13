import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Bot, Save, Loader2, Eye, EyeOff, ShieldCheck, Server, ChevronDown, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
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
  lovable_fallback_enabled: boolean;
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
  lovable_fallback_enabled: true,
};

const TEXT_PROVIDERS = [
  { value: "ollama", label: "Ollama (Local)", description: "Gratuito, roda local na VPS" },
  { value: "openai", label: "OpenAI", description: "API paga da OpenAI" },
  { value: "custom", label: "API Customizada", description: "Qualquer API compatível com OpenAI" },
  { value: "lovable", label: "Lovable AI (Direto)", description: "Usa Lovable AI como provedor principal" },
];

const IMAGE_PROVIDERS = [
  { value: "stable_diffusion", label: "Stable Diffusion (VPS)", description: "Gratuito, roda na sua VPS" },
  { value: "openai", label: "DALL-E (OpenAI)", description: "API paga da OpenAI" },
  { value: "custom", label: "API Customizada", description: "Qualquer API de geração de imagem" },
  { value: "lovable", label: "Lovable AI (Direto)", description: "Usa Lovable AI como provedor principal" },
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

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/50 border rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
        {text}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1 rounded bg-background/80 border text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function SDSetupGuide() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-xs w-full justify-between h-8">
          <span className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" />
            Como configurar Stable Diffusion na VPS
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">1. Instale o Automatic1111 (SDXL WebUI)</p>
            <CopyBlock text={`# Na sua VPS com GPU (Ubuntu/Debian)
sudo apt update && sudo apt install -y git python3 python3-venv wget
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui`} />
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">2. Baixe um modelo SDXL (recomendado para imóveis)</p>
            <CopyBlock text={`# Baixar modelo Juggernaut XL (ótimo para fotos realistas)
wget -O models/Stable-diffusion/juggernautXL_v9.safetensors \\
  "https://civitai.com/api/download/models/456194"

# OU RealVisXL (alternativa)
wget -O models/Stable-diffusion/realvisxl_v5.safetensors \\
  "https://civitai.com/api/download/models/361593"`} />
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">3. Inicie com API habilitada e CORS</p>
            <CopyBlock text={`# Iniciar com API + CORS habilitados
./webui.sh --api --listen --cors-allow-origins="*" --port 7860

# Para rodar em background:
nohup ./webui.sh --api --listen --cors-allow-origins="*" --port 7860 &`} />
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">4. Configure o firewall</p>
            <CopyBlock text={`# Abra a porta 7860 no firewall
sudo ufw allow 7860/tcp

# OU com iptables:
sudo iptables -A INPUT -p tcp --dport 7860 -j ACCEPT`} />
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">5. Teste a API</p>
            <CopyBlock text={`# Teste se a API está respondendo:
curl http://SEU-IP:7860/sdapi/v1/sd-models

# Deve retornar uma lista JSON dos modelos disponíveis`} />
          </div>

          <Alert className="border-yellow-500/30 bg-yellow-500/5">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-xs">
              <strong>Importante:</strong> Use HTTPS com proxy reverso (Nginx/Caddy) em produção. 
              A flag <code className="bg-muted px-1 rounded">--cors-allow-origins="*"</code> é necessária 
              para que a Edge Function consiga chamar a API. Se preferir restringir, 
              use <code className="bg-muted px-1 rounded">--cors-allow-origins="https://aiflfkkjitvsyszwdfga.supabase.co"</code>.
            </AlertDescription>
          </Alert>

          <div className="space-y-1">
            <p className="font-semibold text-foreground">6. Cole a URL acima</p>
            <p>Formato: <code className="bg-muted px-1 rounded">http://SEU-IP:7860</code> (sem barra no final)</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TestConnectionButton({ url, type }: { url: string; type: "sd" | "ollama" }) {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [models, setModels] = useState<string[]>([]);

  const test = async () => {
    if (!url) {
      toast.error("Preencha a URL primeiro");
      return;
    }
    setTesting(true);
    setStatus("idle");
    setModels([]);
    try {
      const { data, error } = await supabase.functions.invoke("test-ai-connection", {
        body: { url: url.replace(/\/+$/, ""), type },
      });
      if (error) throw new Error(error.message);
      if (data?.ok) {
        setStatus("success");
        setModels(data.models || []);
        const label = type === "sd" ? "Stable Diffusion" : "Ollama";
        toast.success(`Conexão com ${label} OK! ${data.models?.length || 0} modelo(s) encontrado(s).`);
      } else {
        throw new Error(data?.error || "Falha na conexão");
      }
    } catch (err: any) {
      setStatus("error");
      toast.error(`Falha na conexão: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={test} disabled={testing} className="gap-1.5 text-xs h-7">
        {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : 
         status === "success" ? <CheckCircle2 className="h-3 w-3 text-green-500" /> :
         status === "error" ? <AlertTriangle className="h-3 w-3 text-destructive" /> : null}
        Testar Conexão
      </Button>
      {models.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Modelos: {models.join(", ")}
        </p>
      )}
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
          lovable_fallback_enabled: (data as any).lovable_fallback_enabled ?? true,
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
        {/* LOVABLE AI FALLBACK TOGGLE */}
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
            <div className="space-y-3">
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
              <TestConnectionButton url={config.text_ollama_url} type="ollama" />
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
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">URL do Stable Diffusion (Automatic1111)</Label>
                <Input
                  value={config.image_sd_url}
                  onChange={(e) => update("image_sd_url", e.target.value)}
                  placeholder="http://seu-ip:7860"
                />
              </div>
              <TestConnectionButton url={config.image_sd_url} type="sd" />
              <SDSetupGuide />
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
            {config.lovable_fallback_enabled
              ? "✅ Fallback Lovable AI ativo — se o provedor falhar, a IA continua funcionando."
              : "⚠️ Fallback desativado — apenas o provedor selecionado será usado."}
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
