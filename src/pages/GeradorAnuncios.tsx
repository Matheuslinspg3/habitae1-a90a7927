import { useState, useEffect, useMemo, useCallback } from "react";
import { AdImageGenerator } from "@/components/ads/AdImageGenerator";
import { BrandInlineCard } from "@/components/marketing/BrandInlineCard";
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
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Sparkles, Copy, Check, Globe, Instagram, MessageCircle, Home, Loader2, RefreshCw, Save, History, ChevronDown, RotateCcw, FileText, ChevronUp, ImagePlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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

type ResultKey = "portal" | "instagram" | "whatsapp";
type Tone = "formal" | "emocional" | "direto" | "luxo";

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "formal", label: "Formal e técnico" },
  { value: "emocional", label: "Envolvente e emocional" },
  { value: "direto", label: "Direto e objetivo" },
  { value: "luxo", label: "Luxo e sofisticação" },
];

const CHAR_LIMITS: Record<ResultKey, { min: number; max: number; label: string }> = {
  portal: { min: 600, max: 1500, label: "Portal" },
  instagram: { min: 100, max: 800, label: "Instagram" },
  whatsapp: { min: 50, max: 400, label: "WhatsApp" },
};

function CharCounter({ count, min, max }: { count: number; min: number; max: number }) {
  const color = count >= min && count <= max
    ? "text-success"
    : count > max
      ? "text-destructive"
      : count >= min * 0.7
        ? "text-warning"
        : "text-muted-foreground";

  const badgeVariant = count >= min && count <= max
    ? "default" as const
    : count > max
      ? "destructive" as const
      : "secondary" as const;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className={color}>{count} caracteres</span>
      <Badge variant={badgeVariant} className="text-[10px]">
        Ideal: {min}–{max}
      </Badge>
    </div>
  );
}

export default function GeradorAnuncios({ embedded }: { embedded?: boolean } = {}) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
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
  const [tone, setTone] = useState<Tone>("formal");
  const [loading, setLoading] = useState(false);
  const [regeneratingChannel, setRegeneratingChannel] = useState<ResultKey | null>(null);
  const [results, setResults] = useState<Record<ResultKey, string> | null>(null);
  const [copied, setCopied] = useState<Record<ResultKey, boolean>>({ portal: false, instagram: false, whatsapp: false });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imagePrompts, setImagePrompts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiProviderInfo, setAiProviderInfo] = useState<{ provider: string; model: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<ResultKey, boolean>>({ portal: false, instagram: false, whatsapp: false });
  const [confirmLoadItem, setConfirmLoadItem] = useState<any>(null);
  const [propertySearch, setPropertySearch] = useState("");
  const [generatingFullAd, setGeneratingFullAd] = useState(false);
  const [showImageGenerator, setShowImageGenerator] = useState(false);

  // Debounced property search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(propertySearch), 300);
    return () => clearTimeout(timer);
  }, [propertySearch]);

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

  // Fetch property images when a property is selected
  const { data: propertyImages = [] } = useQuery({
    queryKey: ["property-images-for-ad", form.property_id],
    queryFn: async () => {
      if (!form.property_id) return [];
      const { data } = await supabase
        .from("property_images")
        .select("id, url, is_cover, display_order, r2_key_full, r2_key_thumb, storage_provider, cached_thumbnail_url")
        .eq("property_id", form.property_id)
        .order("display_order");
      return data || [];
    },
    enabled: !!form.property_id,
  });

  const filteredProperties = useMemo(() => {
    if (!debouncedSearch) return properties;
    const q = debouncedSearch.toLowerCase();
    return properties.filter((p: any) =>
      p.title?.toLowerCase().includes(q) ||
      p.property_code?.toLowerCase().includes(q) ||
      p.address_neighborhood?.toLowerCase().includes(q) ||
      p.address_city?.toLowerCase().includes(q)
    );
  }, [properties, debouncedSearch]);

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

  // Fetch history
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["anuncios_gerados", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data } = await supabase
        .from("anuncios_gerados")
        .select("id, created_at, dados_formulario, texto_portal, texto_instagram, texto_whatsapp, imagem_url, property_id, tone")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(20);
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

  const callGenerateContent = async (channel?: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-content", {
        body: {
          formData: form,
          leadName: selectedLead?.name || null,
          tone,
          channel: channel || "all",
        },
      });

      clearTimeout(timeout);
      if (error) throw new Error(error.message || "Erro ao gerar anúncios");
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") throw new Error("Tempo limite excedido (45s). Tente novamente.");
      throw err;
    }
  };

  const handleGenerate = async () => {
    if (!form.tipo || !form.finalidade || !form.bairro_cidade) {
      toast.error("Preencha tipo, finalidade e localização.");
      return;
    }

    setLoading(true);
    setResults(null);
    setImagePrompts([]);

    try {
      const data = await callGenerateContent();

      setResults({
        portal: data.portal,
        instagram: data.instagram,
        whatsapp: data.whatsapp,
      });

      if (data._ai_provider || data._ai_model) {
        setAiProviderInfo({ provider: data._ai_provider || "unknown", model: data._ai_model || "" });
      }

      if (data.image_prompts?.length) {
        setImagePrompts(data.image_prompts);
      }

      toast.success("Anúncios gerados com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Ocorreu um erro ao gerar os anúncios. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFullAd = async () => {
    if (!form.tipo || !form.finalidade || !form.bairro_cidade) {
      toast.error("Preencha tipo, finalidade e localização.");
      return;
    }
    if (!form.property_id && propertyImages.length === 0) {
      toast.error("Selecione um imóvel com fotos para gerar o anúncio completo.");
      return;
    }

    setGeneratingFullAd(true);
    setLoading(true);
    setResults(null);
    setGeneratedImage(null);

    try {
      // 1. Generate text
      const data = await callGenerateContent();
      setResults({
        portal: data.portal,
        instagram: data.instagram,
        whatsapp: data.whatsapp,
      });
      if (data._ai_provider || data._ai_model) {
        setAiProviderInfo({ provider: data._ai_provider || "unknown", model: data._ai_model || "" });
      }

      // 2. Generate image using first property image
      if (propertyImages.length > 0) {
        const { getImageUrl } = await import("@/lib/imageUrl");
        const coverImg = propertyImages.find((i: any) => i.is_cover) || propertyImages[0];
        const imgUrl = getImageUrl(coverImg as any, "full");

        const formatCurrency = (v: number | null | undefined) =>
          v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";

        const overlayData = {
          title: form.tipo ? `${form.tipo} ${form.finalidade ? `para ${form.finalidade}` : ""}`.trim() : undefined,
          price: formatCurrency(form.valor) || undefined,
          area: form.metragem ? `${form.metragem}m²` : undefined,
          bedrooms: form.quartos ? `${form.quartos} quartos` : undefined,
          parking: form.vagas ? `${form.vagas} vagas` : undefined,
          neighborhood: form.bairro_cidade || undefined,
        };

        const { data: imgData, error: imgError } = await supabase.functions.invoke("generate-ad-image", {
          body: {
            imageUrl: imgUrl,
            format: "feed",
            style: "template",
            overlayData,
            aiProvider: "gemini",
          },
        });

        if (!imgError && imgData?.imageUrl) {
          setGeneratedImage(imgData.imageUrl);
        }
      }

      toast.success("Anúncio completo gerado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar anúncio completo.");
    } finally {
      setLoading(false);
      setGeneratingFullAd(false);
    }
  };
  const handleRegenerateChannel = async (channel: ResultKey) => {
    if (!form.tipo || !form.finalidade || !form.bairro_cidade) {
      toast.error("Preencha tipo, finalidade e localização.");
      return;
    }

    setRegeneratingChannel(channel);

    try {
      const data = await callGenerateContent(channel);
      if (data[channel]) {
        setResults((prev) => prev ? { ...prev, [channel]: data[channel] } : null);
        toast.success(`Texto de ${CHAR_LIMITS[channel].label} regenerado!`);
      }
    } catch (err: any) {
      toast.error(err.message || `Erro ao regenerar texto de ${CHAR_LIMITS[channel].label}.`);
    } finally {
      setRegeneratingChannel(null);
    }
  };

  const handleSave = async () => {
    if ((!results && !generatedImage) || !user || !profile?.organization_id) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("anuncios_gerados").insert({
        organization_id: profile.organization_id,
        corretor_id: user.id,
        texto_portal: results?.portal || null,
        texto_instagram: results?.instagram || null,
        texto_whatsapp: results?.whatsapp || null,
        dados_formulario: { ...form, lead_name: selectedLead?.name, tone } as any,
        property_id: form.property_id || null,
        tone,
        imagem_url: generatedImage || null,
      } as any);

      if (error) throw error;

      toast.success("Geração salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["anuncios_gerados"] });
    } catch {
      toast.error("Não foi possível salvar a geração. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleLoadHistory = (item: any) => {
    if (results || generatedImage) {
      setConfirmLoadItem(item);
      return;
    }
    doLoadHistory(item);
  };

  const doLoadHistory = (item: any) => {
    const formData = item.dados_formulario as any;
    if (formData) {
      setForm({
        property_id: formData.property_id || item.property_id || "",
        lead_id: formData.lead_id || "",
        tipo: formData.tipo || "",
        finalidade: formData.finalidade || "",
        bairro_cidade: formData.bairro_cidade || "",
        valor: formData.valor ?? null,
        metragem: formData.metragem ?? null,
        quartos: formData.quartos ?? null,
        suites: formData.suites ?? null,
        vagas: formData.vagas ?? null,
        diferenciais: formData.diferenciais || "",
      });
      if (formData.tone || item.tone) setTone(formData.tone || item.tone);
    }
    const hasText = item.texto_portal || item.texto_instagram || item.texto_whatsapp;
    if (hasText) {
      setResults({
        portal: item.texto_portal || "",
        instagram: item.texto_instagram || "",
        whatsapp: item.texto_whatsapp || "",
      });
    } else {
      setResults(null);
    }
    setGeneratedImage(item.imagem_url || null);
    setConfirmLoadItem(null);
    toast.success("Geração carregada!");
  };

  // handleGenerateImages removed — now using AdImageGenerator component

  const handleCopy = async (key: ResultKey) => {
    if (!results) return;
    await navigator.clipboard.writeText(results[key]);
    setCopied((prev) => ({ ...prev, [key]: true }));
    toast.success("Texto copiado para a área de transferência!");
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
  };

  const updateResult = (key: ResultKey, value: string) => {
    if (!results) return;
    setResults({ ...results, [key]: value });
  };



  const toggleExpand = (key: ResultKey) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAnyRegenerating = !!regeneratingChannel;

  const resultCards: { key: ResultKey; title: string; icon: React.ReactNode }[] = [
    { key: "portal", title: "Portal (OLX / ZAP)", icon: <Globe className="h-5 w-5" /> },
    { key: "instagram", title: "Instagram / Facebook Ads", icon: <Instagram className="h-5 w-5" /> },
    { key: "whatsapp", title: "WhatsApp", icon: <MessageCircle className="h-5 w-5" /> },
  ];

  const TEXT_PREVIEW_LENGTH = 300;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {!embedded && <PageHeader title="Gerador de Anúncios" description="Gere textos e imagens otimizados para anúncios com IA" />}

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
                <Label htmlFor="property-select">Imóvel (opcional)</Label>
                <Input
                  placeholder="Buscar por código, título ou bairro..."
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  className="h-9 text-sm"
                  aria-label="Buscar imóvel"
                />
                <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger id="property-select" className="w-full">
                    <SelectValue placeholder="Selecione um imóvel" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none__">Nenhum (preencher manual)</SelectItem>
                    {filteredProperties.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        #{p.property_code} — {p.title || "Sem título"} — {p.address_neighborhood || ""}, {p.address_city || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Ao selecionar, os campos serão preenchidos automaticamente.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-select">Lead / Cliente (opcional)</Label>
                <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger id="lead-select" className="w-full">
                    <SelectValue placeholder="Selecione um lead" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
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

        {/* Brand Identity - collapsible */}
        <BrandInlineCard onNavigate={() => {
          // Navigate to Marketing > Marca tab
          window.location.href = "/marketing?section=marca";
        }} />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados do Imóvel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo-select">Tipo de imóvel</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger id="tipo-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Casa">Casa</SelectItem>
                    <SelectItem value="Apartamento">Apartamento</SelectItem>
                    <SelectItem value="Terreno">Terreno</SelectItem>
                    <SelectItem value="Sala Comercial">Sala Comercial</SelectItem>
                    <SelectItem value="Cobertura">Cobertura</SelectItem>
                    <SelectItem value="Kitnet">Kitnet</SelectItem>
                    <SelectItem value="Sobrado">Sobrado</SelectItem>
                    <SelectItem value="Galpão">Galpão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finalidade-select">Finalidade</Label>
                <Select value={form.finalidade} onValueChange={(v) => setForm({ ...form, finalidade: v })}>
                  <SelectTrigger id="finalidade-select"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Venda">Venda</SelectItem>
                    <SelectItem value="Aluguel">Aluguel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bairro-input">Bairro e Cidade</Label>
              <Input
                id="bairro-input"
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
                <Label htmlFor="metragem-input">Metragem (m²)</Label>
                <Input
                  id="metragem-input"
                  type="number"
                  placeholder="Ex: 120"
                  value={form.metragem ?? ""}
                  onChange={(e) => setForm({ ...form, metragem: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quartos-input">Quartos</Label>
                <Input
                  id="quartos-input"
                  type="number"
                  placeholder="0"
                  value={form.quartos ?? ""}
                  onChange={(e) => setForm({ ...form, quartos: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suites-input">Suítes</Label>
                <Input
                  id="suites-input"
                  type="number"
                  placeholder="0"
                  value={form.suites ?? ""}
                  onChange={(e) => setForm({ ...form, suites: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vagas-input">Vagas</Label>
                <Input
                  id="vagas-input"
                  type="number"
                  placeholder="0"
                  value={form.vagas ?? ""}
                  onChange={(e) => setForm({ ...form, vagas: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="diferenciais-textarea">Diferenciais</Label>
              <Textarea
                id="diferenciais-textarea"
                placeholder="Ex: Piscina, churrasqueira, vista para o mar, próximo ao metrô..."
                value={form.diferenciais}
                onChange={(e) => setForm({ ...form, diferenciais: e.target.value })}
                rows={3}
              />
            </div>

            {/* Tone selector */}
            <div className="space-y-2">
              <Label htmlFor="tone-select">Tom do anúncio</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger id="tone-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={handleGenerate}
                disabled={loading || generatingFullAd}
                className="w-full sm:w-auto gap-2 h-10"
              >
                {loading && !generatingFullAd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading && !generatingFullAd ? "Gerando textos..." : "Gerar Textos"}
              </Button>

              <Button
                onClick={() => setShowImageGenerator(true)}
                disabled={loading || generatingFullAd}
                variant="outline"
                className="w-full sm:w-auto gap-2 h-10"
              >
                <ImagePlus className="h-4 w-4" />
                Gerar Imagem
              </Button>

              <Button
                onClick={handleGenerateFullAd}
                disabled={loading || generatingFullAd}
                variant="default"
                className="w-full sm:w-auto gap-2 h-10 bg-gradient-to-r from-primary to-primary/80"
              >
                {generatingFullAd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generatingFullAd ? "Gerando anúncio..." : "Gerar Anúncio Completo"}
              </Button>

              {aiProviderInfo && !loading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md border">
                  <span className="font-medium">
                    {aiProviderInfo.provider === "lovable" ? "Lovable AI" :
                     aiProviderInfo.provider === "openai" ? "OpenAI" :
                     aiProviderInfo.provider === "gemini" ? "Google Gemini" :
                     aiProviderInfo.provider === "anthropic" ? "Anthropic" :
                     aiProviderInfo.provider === "groq" ? "Groq" :
                     aiProviderInfo.provider}
                  </span>
                  {aiProviderInfo.model && (
                    <span className="text-muted-foreground/70">• {aiProviderInfo.model}</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {(loading || results) && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resultCards.map(({ key, title, icon }) => {
                const charCount = results?.[key]?.length || 0;
                const limits = CHAR_LIMITS[key];
                const isRegenerating = regeneratingChannel === key;
                const text = results?.[key] || "";
                const isLong = text.length > TEXT_PREVIEW_LENGTH;
                const isExpanded = expandedCards[key];

                return (
                  <Card key={key}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-primary">{icon}</span>
                        {title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {loading || isRegenerating ? (
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
                            value={isExpanded || !isLong ? text : text.slice(0, TEXT_PREVIEW_LENGTH) + "..."}
                            onChange={(e) => updateResult(key, e.target.value)}
                            rows={isExpanded ? 12 : 8}
                            className="text-sm resize-none"
                            aria-label={`Texto para ${title}`}
                          />

                          {isLong && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-7 text-xs text-muted-foreground"
                              onClick={() => toggleExpand(key)}
                            >
                              {isExpanded ? (
                                <><ChevronUp className="h-3 w-3 mr-1" /> Recolher</>
                              ) : (
                                <><ChevronDown className="h-3 w-3 mr-1" /> Ver mais</>
                              )}
                            </Button>
                          )}

                          <CharCounter count={charCount} min={limits.min} max={limits.max} />

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1 h-9"
                              onClick={() => handleCopy(key)}
                              aria-label={`Copiar texto de ${title}`}
                            >
                              {copied[key] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copied[key] ? "Copiado!" : "Copiar"}
                            </Button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 h-9"
                                  onClick={() => handleRegenerateChannel(key)}
                                  disabled={isAnyRegenerating}
                                  aria-label={`Regenerar apenas o canal ${title}`}
                                >
                                  <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
                                  Regenerar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Regenerar apenas este canal</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Save button */}
            {(results || generatedImage) && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2 h-10">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Salvando..." : "Salvar Geração"}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Image Generation - always visible when property selected or after text generation */}
        {(form.property_id || results || showImageGenerator) && (
          <AdImageGenerator
            propertyImages={propertyImages}
            formData={{
              tipo: form.tipo,
              finalidade: form.finalidade,
              bairro_cidade: form.bairro_cidade,
              diferenciais: form.diferenciais,
              valor: form.valor,
              quartos: form.quartos,
              vagas: form.vagas,
              metragem: form.metragem,
            }}
            generatedImage={generatedImage}
            onImageGenerated={setGeneratedImage}
          />
        )}

        {/* History */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Últimas gerações
                    {history.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{history.length}</Badge>
                    )}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", historyOpen && "rotate-180")} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {historyLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <h3 className="text-sm font-medium text-muted-foreground">Nenhuma geração salva ainda</h3>
                    <p className="text-xs text-muted-foreground mt-1">Gere seu primeiro anúncio e salve para acessá-lo aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item: any) => {
                      const formData = item.dados_formulario as any;
                      const date = new Date(item.created_at);
                      const hasText = !!(item.texto_portal || item.texto_instagram || item.texto_whatsapp);
                      const hasImage = !!item.imagem_url;
                      const genType = hasText && hasImage ? "completo" : hasImage ? "imagem" : "texto";

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          {/* Thumbnail */}
                          {hasImage && (
                            <img
                              src={item.imagem_url}
                              alt="Imagem gerada"
                              className="h-14 w-14 rounded-md object-cover border flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">
                                {formData?.tipo || "—"} • {formData?.finalidade || "—"}
                              </span>
                              <Badge
                                variant={genType === "completo" ? "default" : "outline"}
                                className="text-[10px]"
                              >
                                {genType === "completo" ? "📦 Completo" : genType === "imagem" ? "🖼️ Imagem" : "📝 Texto"}
                              </Badge>
                              {item.tone && (
                                <Badge variant="secondary" className="text-[10px]">{item.tone}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {formData?.bairro_cidade || "—"} • {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 shrink-0 h-9"
                            onClick={() => handleLoadHistory(item)}
                            aria-label="Carregar esta geração"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Carregar
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Confirm Load History Dialog */}
        <Dialog open={!!confirmLoadItem} onOpenChange={() => setConfirmLoadItem(null)}>
          <DialogContent className="w-full sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Substituir geração atual?</DialogTitle>
              <DialogDescription>
                Você tem uma geração em andamento. Ao carregar esta geração do histórico, os textos atuais serão substituídos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmLoadItem(null)}>
                Cancelar
              </Button>
              <Button onClick={() => confirmLoadItem && doLoadHistory(confirmLoadItem)}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
