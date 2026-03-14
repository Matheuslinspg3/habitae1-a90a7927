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
import { Sparkles, Copy, Check, Globe, Instagram, MessageCircle, Home, Download, Loader2, ImagePlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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

export default function GeradorAnuncios({ embedded }: { embedded?: boolean } = {}) {
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
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePrompts, setImagePrompts] = useState<string[]>([]);

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
    setImagePrompts([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-content", {
        body: {
          formData: form,
          leadName: selectedLead?.name || null,
        },
      });

      if (error) throw new Error(error.message || "Erro ao gerar anúncios");
      if (data?.error) throw new Error(data.error);

      setResults({
        portal: data.portal,
        instagram: data.instagram,
        whatsapp: data.whatsapp,
      });

      if (data.image_prompts?.length) {
        setImagePrompts(data.image_prompts);
      }

      // Save to DB
      if (user && profile?.organization_id) {
        await supabase.from("anuncios_gerados").insert({
          organization_id: profile.organization_id,
          corretor_id: user.id,
          texto_portal: data.portal,
          texto_instagram: data.instagram,
          texto_whatsapp: data.whatsapp,
          dados_formulario: { ...form, lead_name: selectedLead?.name } as any,
        });
      }

      toast.success("Anúncios gerados com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar anúncios:", err);
      toast.error(err.message || "Erro ao gerar anúncios");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImages = async () => {
    if (imagePrompts.length === 0) {
      toast.error("Gere os textos primeiro para obter os prompts de imagem.");
      return;
    }

    setImageLoading(true);
    setGeneratedImages([]);

    try {
      const results = await Promise.allSettled(
        imagePrompts.slice(0, 3).map((prompt) =>
          supabase.functions.invoke("generate-ad-image", { body: { prompt } })
        )
      );

      const images: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.data?.imageUrl) {
          images.push(result.value.data.imageUrl);
        }
      }

      if (images.length === 0) {
        throw new Error("Nenhuma imagem foi gerada. Tente novamente.");
      }

      setGeneratedImages(images);
      toast.success(`${images.length} imagem(ns) gerada(s)!`);
    } catch (err: any) {
      console.error("Erro ao gerar imagens:", err);
      toast.error(err.message || "Erro ao gerar imagens");
    } finally {
      setImageLoading(false);
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

  const handleDownloadImage = (imageUrl: string, index: number) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `anuncio-imagem-${index + 1}-${Date.now()}.png`;
    link.click();
  };

  const resultCards: { key: ResultKey; title: string; icon: React.ReactNode; color: string }[] = [
    { key: "portal", title: "Portal (OLX / ZAP)", icon: <Globe className="h-5 w-5" />, color: "text-blue-500" },
    { key: "instagram", title: "Instagram / Facebook Ads", icon: <Instagram className="h-5 w-5" />, color: "text-pink-500" },
    { key: "whatsapp", title: "WhatsApp", icon: <MessageCircle className="h-5 w-5" />, color: "text-green-500" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Gerador de Anúncios" description="Gere textos e imagens otimizados para anúncios com IA" />

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
            {loading ? "Gerando textos..." : "Gerar Anúncios"}
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

      {/* Image Generation */}
      {imagePrompts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImagePlus className="h-5 w-5 text-primary" />
              Imagens do Anúncio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A IA sugeriu {imagePrompts.length} imagens para o seu anúncio. Clique para gerar.
            </p>

            <Button
              onClick={handleGenerateImages}
              disabled={imageLoading}
              className="gap-2"
            >
              {imageLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {imageLoading ? "Gerando imagens..." : `Gerar ${imagePrompts.length} Imagens`}
            </Button>

            {imageLoading && generatedImages.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {imagePrompts.map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            )}

            {generatedImages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {generatedImages.map((img, i) => (
                  <div key={i} className="space-y-2">
                    <img
                      src={img}
                      alt={`Imagem gerada ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border shadow-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleDownloadImage(img, i)}
                    >
                      <Download className="h-4 w-4" />
                      Baixar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
