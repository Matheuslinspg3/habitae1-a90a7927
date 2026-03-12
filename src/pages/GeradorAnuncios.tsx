import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import { Sparkles, Copy, Check, Globe, Instagram, MessageCircle, Home, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AdImageGenerator } from "@/components/ads/AdImageGenerator";

const OLLAMA_URL = import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434";

interface FormData {
  property_id: string;
  lead_id: string;
  tipo: string;
  finalidade: string;
  bairro_cidade: string;
  valor: number | null;
  metragem: number | null;
  quartos: number | null;
  suites: number | null;
  vagas: number | null;
  diferenciais: string;
}

const buildPrompt = (data: FormData, leadName: string | null, version: "portal" | "instagram" | "whatsapp") => {
  const base = `Imóvel: ${data.tipo}, ${data.finalidade}. Localização: ${data.bairro_cidade}. Valor: R$ ${data.valor?.toLocaleString("pt-BR") ?? "N/I"}. Metragem: ${data.metragem ?? "N/I"} m². Quartos: ${data.quartos ?? 0}, Suítes: ${data.suites ?? 0}, Vagas: ${data.vagas ?? 0}. Diferenciais: ${data.diferenciais || "Nenhum informado"}.`;

  if (version === "portal") {
    return `Você é um copywriter imobiliário profissional. Crie uma descrição técnica e completa para portais como OLX e ZAP Imóveis. Seja detalhista, use linguagem profissional, inclua todas as informações relevantes. Não use emojis. Escreva em português do Brasil.\n\nDados do imóvel:\n${base}\n\nDescrição para portal:`;
  }
  if (version === "instagram") {
    return `Você é um social media especializado em imóveis. Crie um texto envolvente para Instagram com emojis estratégicos. Máximo 150 palavras. Use hashtags relevantes no final. Escreva em português do Brasil.\n\nDados do imóvel:\n${base}\n\nTexto para Instagram:`;
  }
  return `Você é um corretor de imóveis experiente. Crie uma mensagem curta e direta para WhatsApp${leadName ? ` direcionada ao cliente ${leadName}` : ""}. Máximo 80 palavras. Use no máximo 3 emojis. Seja objetivo e inclua chamada para ação. Escreva em português do Brasil.\n\nDados do imóvel:\n${base}\n\nMensagem para WhatsApp:`;
};

const fetchOllama = async (prompt: string) => {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llama3", stream: false, prompt }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const json = await res.json();
  return json.response as string;
};

type ResultKey = "portal" | "instagram" | "whatsapp";

export default function GeradorAnuncios() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState<FormData>({
    property_id: "",
    lead_id: "",
    tipo: "",
    finalidade: "",
    bairro_cidade: "",
    valor: null,
    metragem: null,
    quartos: null,
    suites: null,
    vagas: null,
    diferenciais: "",
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<ResultKey, string> | null>(null);
  const [copied, setCopied] = useState<Record<ResultKey, boolean>>({ portal: false, instagram: false, whatsapp: false });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Fetch properties
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-for-ad-gen", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data } = await supabase
        .from("properties")
        .select("id, title, property_code, transaction_type, sale_price, rent_price, bedrooms, suites, parking_spots, area_built, area_total, address_neighborhood, address_city, address_state, amenities, description, property_type_id, property_types:property_type_id(name)")
        .eq("organization_id", profile.organization_id)
        .eq("status", "disponivel")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch leads
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-ad-gen", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, email")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  // Auto-fill form when property is selected
  useEffect(() => {
    if (!form.property_id) return;
    const prop = properties.find((p: any) => p.id === form.property_id);
    if (!prop) return;

    const typeName = (prop as any).property_types?.name || "";
    const transType = prop.transaction_type === "venda" ? "Venda" : prop.transaction_type === "aluguel" ? "Aluguel" : "";
    const valor = prop.transaction_type === "venda" ? prop.sale_price : prop.rent_price;
    const location = [prop.address_neighborhood, prop.address_city, prop.address_state].filter(Boolean).join(", ");
    const amenities = Array.isArray(prop.amenities) ? (prop.amenities as string[]).join(", ") : "";

    setForm((prev) => ({
      ...prev,
      tipo: typeName || prev.tipo,
      finalidade: transType || prev.finalidade,
      bairro_cidade: location || prev.bairro_cidade,
      valor: valor ?? prev.valor,
      metragem: prop.area_built ?? prop.area_total ?? prev.metragem,
      quartos: prop.bedrooms ?? prev.quartos,
      suites: prop.suites ?? prev.suites,
      vagas: prop.parking_spots ?? prev.vagas,
      diferenciais: amenities || prev.diferenciais,
    }));
  }, [form.property_id, properties]);

  const selectedLead = leads.find((l: any) => l.id === form.lead_id);

  const handleGenerate = async () => {
    if (!form.tipo || !form.finalidade || !form.bairro_cidade) {
      toast.error("Preencha tipo, finalidade e localização.");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const leadName = selectedLead?.name || null;
      const [portal, instagram, whatsapp] = await Promise.all([
        fetchOllama(buildPrompt(form, leadName, "portal")),
        fetchOllama(buildPrompt(form, leadName, "instagram")),
        fetchOllama(buildPrompt(form, leadName, "whatsapp")),
      ]);

      const newResults = { portal, instagram, whatsapp };
      setResults(newResults);

      // Save to DB
      if (user && profile?.organization_id) {
        await supabase.from("anuncios_gerados").insert({
          organization_id: profile.organization_id,
          corretor_id: user.id,
          texto_portal: portal,
          texto_instagram: instagram,
          texto_whatsapp: whatsapp,
          dados_formulario: { ...form, lead_name: selectedLead?.name } as any,
        });
      }

      toast.success("Anúncios gerados com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar anúncios:", err);
      toast.error(err?.message?.includes("Failed to fetch")
        ? "Não foi possível conectar ao Ollama. Verifique se a URL está correta e o CORS está habilitado."
        : `Erro ao gerar: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (key: ResultKey) => {
    if (!results) return;
    await navigator.clipboard.writeText(results[key]);
    setCopied((prev) => ({ ...prev, [key]: true }));
    toast.success("Copiado!");
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
  };

  const updateResult = (key: ResultKey, value: string) => {
    if (!results) return;
    setResults({ ...results, [key]: value });
  };

  const resultCards: { key: ResultKey; title: string; icon: React.ReactNode; color: string }[] = [
    { key: "portal", title: "Portal (OLX / ZAP)", icon: <Globe className="h-5 w-5" />, color: "text-blue-500" },
    { key: "instagram", title: "Instagram", icon: <Instagram className="h-5 w-5" />, color: "text-pink-500" },
    { key: "whatsapp", title: "WhatsApp", icon: <MessageCircle className="h-5 w-5" />, color: "text-green-500" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Gerador de Anúncios" description="Gere textos otimizados para diferentes plataformas com IA" />

      {/* Property & Lead Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            Vincular Imóvel e Lead
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Imóvel (opcional)</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v === "__none__" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um imóvel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (preencher manual)</SelectItem>
                  {properties.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      #{p.property_code} — {p.title || "Sem título"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Ao selecionar, os campos serão preenchidos automaticamente.</p>
            </div>
            <div className="space-y-2">
              <Label>Lead / Cliente (opcional)</Label>
              <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v === "__none__" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {leads.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.phone ? ` — ${l.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">O nome do lead será usado na mensagem de WhatsApp.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados do Imóvel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de imóvel</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Casa">Casa</SelectItem>
                  <SelectItem value="Apartamento">Apartamento</SelectItem>
                  <SelectItem value="Terreno">Terreno</SelectItem>
                  <SelectItem value="Sala Comercial">Sala Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Finalidade</Label>
              <Select value={form.finalidade} onValueChange={(v) => setForm({ ...form, finalidade: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bairro e Cidade</Label>
            <Input
              placeholder="Ex: Centro, Curitiba - PR"
              value={form.bairro_cidade}
              onChange={(e) => setForm({ ...form, bairro_cidade: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <CurrencyInput value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
            </div>
            <div className="space-y-2">
              <Label>Metragem (m²)</Label>
              <Input
                type="number"
                placeholder="Ex: 120"
                value={form.metragem ?? ""}
                onChange={(e) => setForm({ ...form, metragem: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Quartos</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.quartos ?? ""}
                onChange={(e) => setForm({ ...form, quartos: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Suítes</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.suites ?? ""}
                onChange={(e) => setForm({ ...form, suites: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Vagas</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.vagas ?? ""}
                onChange={(e) => setForm({ ...form, vagas: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Diferenciais</Label>
            <Textarea
              placeholder="Ex: Piscina, churrasqueira, vista para o mar, próximo ao metrô..."
              value={form.diferenciais}
              onChange={(e) => setForm({ ...form, diferenciais: e.target.value })}
              rows={3}
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto gap-2">
            <Sparkles className="h-4 w-4" />
            {loading ? "Gerando..." : "Gerar Anúncios"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {(loading || results) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {resultCards.map(({ key, title, icon, color }) => (
            <Card key={key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={color}>{icon}</span>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/6" />
                  </div>
                ) : results ? (
                  <>
                    <Textarea
                      value={results[key]}
                      onChange={(e) => updateResult(key, e.target.value)}
                      rows={10}
                      className="text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleCopy(key)}
                    >
                      {copied[key] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied[key] ? "Copiado!" : "Copiar"}
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
