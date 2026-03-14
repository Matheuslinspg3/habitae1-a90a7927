import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Palette, Download, Copy, Check, Loader2, Image as ImageIcon, CheckCircle, AlertTriangle, Camera } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getImageUrl, type ImageRecord } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ArtConfig {
  main_text: string;
  sub_text: string;
  phone: string;
  slogan: string;
  accent_color: string;
  logo_position: string;
}

interface ArtResult {
  url_feed: string | null;
  url_story: string | null;
  url_banner: string | null;
}

const ART_FORMATS = [
  { key: "url_feed" as const, label: "Feed 1080×1080", aspect: "aspect-square" },
  { key: "url_story" as const, label: "Story 1080×1920", aspect: "aspect-[9/16]" },
  { key: "url_banner" as const, label: "Banner 1200×628", aspect: "aspect-[1200/628]" },
];

const MAX_VISIBLE_PHOTOS = 6;

export default function GeradorArtes() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [photoQuality, setPhotoQuality] = useState<{ quality: string; message: string } | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [config, setConfig] = useState<ArtConfig>({
    main_text: "",
    sub_text: "",
    phone: "",
    slogan: "",
    accent_color: "#3B82F6",
    logo_position: "bottom-right",
  });
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ArtResult | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Fetch properties
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-for-art-gen", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data } = await supabase
        .from("properties")
        .select("id, title, property_code, transaction_type, sale_price, rent_price, bedrooms, parking_spots, area_built, area_total, address_neighborhood, address_city")
        .eq("organization_id", profile.organization_id)
        .eq("status", "disponivel")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch images for selected property
  const { data: propertyImages = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["property-images-for-art", selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const { data } = await supabase
        .from("property_images")
        .select("id, url, is_cover, display_order, r2_key_full, r2_key_thumb, storage_provider, cached_thumbnail_url")
        .eq("property_id", selectedPropertyId)
        .order("display_order", { ascending: true });
      return data || [];
    },
    enabled: !!selectedPropertyId,
  });

  // Fetch history for selected property
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["generated_arts", selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const { data } = await supabase
        .from("generated_arts")
        .select("id, url_feed, url_story, url_banner, config, created_at")
        .eq("property_id", selectedPropertyId)
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
    enabled: !!selectedPropertyId,
  });

  const visiblePhotos = useMemo(() => {
    if (showAllPhotos) return propertyImages;
    return propertyImages.slice(0, MAX_VISIBLE_PHOTOS);
  }, [propertyImages, showAllPhotos]);

  const hiddenPhotosCount = Math.max(0, propertyImages.length - MAX_VISIBLE_PHOTOS);

  // Auto-fill config when property changes
  useEffect(() => {
    if (!selectedPropertyId) return;
    const prop = properties.find((p) => p.id === selectedPropertyId);
    if (!prop) return;

    const price = prop.transaction_type === "venda" ? prop.sale_price : prop.rent_price;
    const priceStr = price ? `R$ ${Number(price).toLocaleString("pt-BR")}` : "";
    const parts = [];
    if (prop.bedrooms) parts.push(`${prop.bedrooms} quarto${prop.bedrooms > 1 ? "s" : ""}`);
    if (prop.parking_spots) parts.push(`${prop.parking_spots} vaga${prop.parking_spots > 1 ? "s" : ""}`);
    const area = prop.area_built || prop.area_total;
    if (area) parts.push(`${area}m²`);

    setConfig((prev) => ({
      ...prev,
      main_text: priceStr || prev.main_text,
      sub_text: parts.join(" · ") || prev.sub_text,
      phone: profile?.phone || prev.phone,
    }));

    // Reset selections
    setSelectedImageUrl(null);
    setSelectedImageId(null);
    setPhotoQuality(null);
    setResults(null);
    setShowAllPhotos(false);
  }, [selectedPropertyId, properties, profile]);

  // Analyze photo quality
  const analyzeQuality = async (imageUrl: string) => {
    setQualityLoading(true);
    setPhotoQuality(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-photo-quality", {
        body: { imageUrl },
      });
      if (!error && data) {
        setPhotoQuality({ quality: data.quality, message: data.message });
      }
    } catch {
      // Non-blocking
    } finally {
      setQualityLoading(false);
    }
  };

  const handleSelectImage = (img: any) => {
    const url = getImageUrl(img as ImageRecord, "full");
    setSelectedImageId(img.id);
    setSelectedImageUrl(url);
    setPhotoQuality(null);
    analyzeQuality(url);
  };

  const handleGenerate = async () => {
    if (!selectedPropertyId || !selectedImageUrl) {
      toast.error("Selecione um imóvel e uma foto.");
      return;
    }

    setGenerating(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-property-art", {
        body: {
          propertyId: selectedPropertyId,
          imageUrl: selectedImageUrl,
          config,
        },
      });

      if (error) throw new Error(error.message || "Erro ao gerar artes");
      if (data?.error) throw new Error(data.error);

      setResults({
        url_feed: data.url_feed,
        url_story: data.url_story,
        url_banner: data.url_banner,
      });

      queryClient.invalidateQueries({ queryKey: ["generated_arts", selectedPropertyId] });
      toast.success("Artes geradas com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível gerar as artes. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (url: string, label: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `arte-${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Step 1 - Property & Photo Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Selecione o Imóvel e a Foto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="art-property-select">Imóvel</Label>
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger id="art-property-select">
                <SelectValue placeholder="Buscar imóvel..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {properties.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    #{p.property_code} — {p.title || "Sem título"} — {p.address_neighborhood || ""}, {p.address_city || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Photo grid */}
          {selectedPropertyId && (
            <div className="space-y-2">
              <Label>Foto base para a arte</Label>
              {imagesLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : propertyImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
                  <Camera className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <h3 className="text-sm font-medium text-muted-foreground">Nenhuma foto encontrada</h3>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">Cadastre fotos neste imóvel para gerar artes.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => navigate(`/imoveis/${selectedPropertyId}`)}
                  >
                    Ir para o imóvel
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {visiblePhotos.map((img: any) => {
                      const thumbUrl = getImageUrl(img as ImageRecord, "thumb");
                      const isSelected = selectedImageId === img.id;
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => handleSelectImage(img)}
                          aria-label={`Selecionar foto ${img.display_order || ""}`}
                          className={cn(
                            "relative aspect-square rounded-lg overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isSelected
                              ? "ring-2 ring-primary ring-offset-2 border-primary"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <img
                            src={thumbUrl}
                            alt={`Foto do imóvel ${img.display_order || ""}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="h-6 w-6 text-primary-foreground drop-shadow" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Show more button */}
                  {hiddenPhotosCount > 0 && !showAllPhotos && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs text-muted-foreground"
                      onClick={() => setShowAllPhotos(true)}
                    >
                      Ver mais fotos (+{hiddenPhotosCount})
                    </Button>
                  )}
                  {showAllPhotos && hiddenPhotosCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs text-muted-foreground"
                      onClick={() => setShowAllPhotos(false)}
                    >
                      Mostrar menos
                    </Button>
                  )}
                </>
              )}

              {/* Quality badge - overlay style */}
              {selectedImageId && (
                <div className="flex items-center gap-2 mt-2">
                  {qualityLoading ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Analisando qualidade...
                    </Badge>
                  ) : photoQuality ? (
                    <Badge
                      variant={photoQuality.quality === "good" ? "default" : "destructive"}
                      className="gap-1 text-xs"
                    >
                      {photoQuality.quality === "good" ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {photoQuality.quality === "good" ? "Foto adequada" : "Qualidade reduzida"}
                      {photoQuality.message && ` — ${photoQuality.message}`}
                    </Badge>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 - Customization */}
      {selectedPropertyId && selectedImageUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Personalização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="main-text-input">Texto principal</Label>
                <Input
                  id="main-text-input"
                  placeholder="Ex: R$ 450.000"
                  value={config.main_text}
                  onChange={(e) => setConfig({ ...config, main_text: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-text-input">Subtexto</Label>
                <Input
                  id="sub-text-input"
                  placeholder="Ex: 3 quartos · 2 vagas · 120m²"
                  value={config.sub_text}
                  onChange={(e) => setConfig({ ...config, sub_text: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone-input">Telefone</Label>
                <Input
                  id="phone-input"
                  placeholder="(11) 99999-9999"
                  value={config.phone}
                  onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slogan-input">Slogan (opcional)</Label>
                <Input
                  id="slogan-input"
                  placeholder="Seu imóvel dos sonhos"
                  value={config.slogan}
                  onChange={(e) => setConfig({ ...config, slogan: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor de destaque</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.accent_color}
                    onChange={(e) => setConfig({ ...config, accent_color: e.target.value })}
                    className="h-10 w-14 rounded-md border border-border cursor-pointer"
                    aria-label="Escolher cor de destaque"
                  />
                  <Input
                    value={config.accent_color}
                    onChange={(e) => setConfig({ ...config, accent_color: e.target.value })}
                    className="flex-1"
                    maxLength={7}
                    aria-label="Código hex da cor"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo-pos-select">Posição do logo</Label>
                <Select value={config.logo_position} onValueChange={(v) => setConfig({ ...config, logo_position: v })}>
                  <SelectTrigger id="logo-pos-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Inferior direito</SelectItem>
                    <SelectItem value="bottom-left">Inferior esquerdo</SelectItem>
                    <SelectItem value="top-right">Superior direito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full sm:w-auto gap-2 h-10"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
              {generating ? "Gerando suas artes..." : "Gerar Artes"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {(generating || results) && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
            {ART_FORMATS.map(({ key, label, aspect }) => {
              const url = results?.[key];
              return (
                <Card key={key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {generating ? (
                      <div className="space-y-3">
                        <div className={cn("w-full rounded-lg bg-gradient-to-br from-muted to-muted/50 animate-pulse", aspect)} />
                        <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Gerando...
                        </div>
                      </div>
                    ) : url ? (
                      <>
                        <img
                          src={url}
                          alt={`Arte gerada no formato ${label}`}
                          className={cn("w-full rounded-lg border object-cover", aspect)}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1 h-9"
                            onClick={() => handleDownload(url, label)}
                            aria-label={`Baixar arte ${label}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 h-9"
                            onClick={() => handleCopyUrl(url)}
                            aria-label={`Copiar link da arte ${label}`}
                          >
                            {copiedUrl === url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className={cn("w-full rounded-lg border bg-muted flex items-center justify-center text-muted-foreground text-sm", aspect)}>
                        Não disponível
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      {selectedPropertyId && (history as any[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Artes anteriores deste imóvel</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(history as any[]).map((item) => {
                  const thumb = item.url_feed || item.url_story || item.url_banner;
                  if (!thumb) return null;
                  const date = new Date(item.created_at);
                  return (
                    <div key={item.id} className="relative group rounded-lg overflow-hidden">
                      <img
                        src={thumb}
                        alt={`Arte gerada em ${date.toLocaleDateString("pt-BR")}`}
                        className="w-full aspect-square object-cover border rounded-lg"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end p-2 gap-1">
                        <p className="text-[10px] text-white">
                          {date.toLocaleDateString("pt-BR")}
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs gap-1 w-full"
                          onClick={() => handleDownload(thumb, `historico-${item.id}`)}
                          aria-label={`Baixar arte de ${date.toLocaleDateString("pt-BR")}`}
                        >
                          <Download className="h-3 w-3" />
                          Baixar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
