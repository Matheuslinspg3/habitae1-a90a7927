import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ImagePlus, Download, Loader2, Upload, Check, Wand2, LayoutTemplate, Type, Sparkles, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImageUrl, type ImageRecord } from "@/lib/imageUrl";
import { supabase } from "@/integrations/supabase/client";

interface PropertyImage {
  id: string;
  url: string;
  is_cover: boolean;
  display_order: number;
  r2_key_full?: string | null;
  r2_key_thumb?: string | null;
  storage_provider?: string | null;
  cached_thumbnail_url?: string | null;
}

interface AdImageGeneratorProps {
  propertyImages: PropertyImage[];
  formData: {
    tipo: string;
    finalidade: string;
    bairro_cidade: string;
    diferenciais: string;
    valor?: number | null;
    quartos?: number | null;
    vagas?: number | null;
    metragem?: number | null;
  };
  generatedImage: string | null;
  onImageGenerated: (url: string) => void;
}

type OutputFormat = "feed" | "story";
type EditStyle = "enhance" | "template" | "overlay";

const STYLE_OPTIONS: { value: EditStyle; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "enhance", label: "Melhorar foto", description: "Correção de cor, brilho e qualidade profissional", icon: <Wand2 className="h-4 w-4" /> },
  { value: "template", label: "Arte com moldura", description: "Moldura de marketing com dados do imóvel", icon: <LayoutTemplate className="h-4 w-4" /> },
  { value: "overlay", label: "Adicionar textos", description: "Sobrepor informações diretamente na foto", icon: <Type className="h-4 w-4" /> },
];

const FORMAT_OPTIONS: { value: OutputFormat; label: string; size: string }[] = [
  { value: "feed", label: "Feed", size: "1080×1080" },
  { value: "story", label: "Story", size: "1080×1920" },
];

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function formatCurrency(value: number | null | undefined): string {
  if (!value) return "";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AdImageGenerator({
  propertyImages,
  formData,
  generatedImage,
  onImageGenerated,
}: AdImageGeneratorProps) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("feed");
  const [style, setStyle] = useState<EditStyle>("template");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    setUploadedFile(file);
    setSelectedImageId(null);
    setUploadPreview(URL.createObjectURL(file));
  };

  const selectPropertyImage = (img: PropertyImage) => {
    setSelectedImageId(img.id);
    setUploadedFile(null);
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
      setUploadPreview(null);
    }
  };

  const hasBaseImage = !!uploadedFile || !!selectedImageId;

  const handleGenerate = async () => {
    if (!hasBaseImage) {
      toast.error("Selecione ou envie uma foto do imóvel.");
      return;
    }

    setLoading(true);
    try {
      let imageUrl: string;

      if (uploadedFile) {
        imageUrl = await fileToDataUrl(uploadedFile);
      } else {
        const img = propertyImages.find((i) => i.id === selectedImageId);
        if (!img) throw new Error("Imagem não encontrada.");
        imageUrl = getImageUrl(img as ImageRecord, "full");
      }

      const overlayData = (style === "template" || style === "overlay") ? {
        title: formData.tipo ? `${formData.tipo} ${formData.finalidade ? `para ${formData.finalidade}` : ""}`.trim() : undefined,
        price: formatCurrency(formData.valor) || undefined,
        area: formData.metragem ? `${formData.metragem}m²` : undefined,
        bedrooms: formData.quartos ? `${formData.quartos} quartos` : undefined,
        parking: formData.vagas ? `${formData.vagas} vagas` : undefined,
        neighborhood: formData.bairro_cidade || undefined,
      } : undefined;

      const { data, error } = await supabase.functions.invoke("generate-ad-image", {
        body: {
          imageUrl,
          format,
          style,
          overlayData,
          customPrompt: customPrompt || undefined,
        },
      });

      if (error) throw new Error(error.message || "Erro ao gerar imagem.");

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.imageUrl) {
        throw new Error("Nenhuma imagem retornada.");
      }

      onImageGenerated(data.imageUrl);
      if (data.promptUsed) setLastPrompt(data.promptUsed);
      toast.success("Imagem gerada com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar imagem:", err);
      toast.error(err.message || "Erro ao gerar imagem. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;
    try {
      const res = await fetch(generatedImage);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `anuncio-${format}-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback
      const link = document.createElement("a");
      link.href = generatedImage;
      link.download = `anuncio-${format}-${Date.now()}.png`;
      link.target = "_blank";
      link.click();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ImagePlus className="h-5 w-5 text-primary" />
          Gerador de Imagem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Property image selector */}
        {propertyImages.length > 0 && (
          <div className="space-y-2">
            <Label>Selecione uma foto do imóvel</Label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {propertyImages.map((img) => {
                const thumbUrl = getImageUrl(img as ImageRecord, "thumb");
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => selectPropertyImage(img)}
                    className={cn(
                      "relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all",
                      selectedImageId === img.id
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <img
                      src={thumbUrl}
                      alt="Foto do imóvel"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {selectedImageId === img.id && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="h-5 w-5 text-primary-foreground drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload manual */}
        <div className="space-y-2">
          <Label>{propertyImages.length > 0 ? "Ou envie uma imagem" : "Envie uma foto do imóvel"}</Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            {uploadPreview && (
              <img
                src={uploadPreview}
                alt="Upload preview"
                className="h-16 w-16 rounded-md object-cover border"
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Style selection */}
        <div className="space-y-2">
          <Label>Estilo da edição</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStyle(opt.value)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
                  style === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {opt.icon}
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Format selection */}
        <div className="space-y-2">
          <Label>Formato de saída</Label>
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as OutputFormat)}
            className="flex gap-4"
          >
            {FORMAT_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`format-${opt.value}`} />
                <Label htmlFor={`format-${opt.value}`} className="text-sm cursor-pointer">
                  {opt.label} <span className="text-xs text-muted-foreground">({opt.size})</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Custom prompt */}
        <div className="space-y-2">
          <Label>Instrução personalizada (opcional)</Label>
          <Textarea
            placeholder="Ex: Adicionar tom quente e aconchegante, usar cores douradas..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Deixe vazio para usar o estilo padrão selecionado acima.
          </p>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={loading || !hasBaseImage}
          className="w-full sm:w-auto gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {loading ? "Processando imagem..." : "Gerar Imagem"}
        </Button>

        {/* Loading skeleton */}
        {loading && !generatedImage && (
          <Skeleton className={cn(
            "w-full max-w-md rounded-lg",
            format === "feed" ? "aspect-square" : "aspect-[9/16]"
          )} />
        )}

        {/* Generated image preview */}
        {generatedImage && !loading && (
          <div className="space-y-3">
            <img
              src={generatedImage}
              alt="Imagem gerada para anúncio"
              className={cn(
                "w-full max-w-md rounded-lg border shadow-sm",
                format === "feed" ? "aspect-square object-cover" : "aspect-[9/16] object-cover"
              )}
            />
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar Imagem
              </Button>
              {lastPrompt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPrompt(!showPrompt)}
                  className="gap-2 text-muted-foreground"
                >
                  {showPrompt ? "Ocultar prompt" : "Ver prompt usado"}
                </Button>
              )}
            </div>
            {showPrompt && lastPrompt && (
              <div className="bg-muted/50 border rounded-md p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                {lastPrompt}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
