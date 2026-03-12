import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImagePlus, Download, Loader2, Upload, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImageUrl, type ImageRecord } from "@/lib/imageUrl";

const SD_URL = import.meta.env.VITE_SD_URL || "";

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
  };
  generatedImage: string | null;
  onImageGenerated: (base64: string) => void;
}

const buildImagePrompt = (data: AdImageGeneratorProps["formData"]): string => {
  const parts = [
    "professional real estate advertisement photo",
    "high quality",
    "bright natural lighting",
    "modern interior design",
  ];
  if (data.tipo) parts.push(data.tipo.toLowerCase());
  if (data.finalidade) parts.push(`for ${data.finalidade.toLowerCase()}`);
  if (data.diferenciais) {
    const features = data.diferenciais.split(",").slice(0, 3).map((f) => f.trim()).filter(Boolean);
    parts.push(...features);
  }
  return parts.join(", ");
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const imageUrlToBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToBase64(blob as any);
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sdConfigured = !!SD_URL;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    setUploadedFile(file);
    setSelectedImageId(null);
    const url = URL.createObjectURL(file);
    setUploadPreview(url);
  };

  const selectPropertyImage = (img: PropertyImage) => {
    setSelectedImageId(img.id);
    setUploadedFile(null);
    setUploadPreview(null);
  };

  const getSelectedImageUrl = (): string | null => {
    if (uploadPreview) return null; // will use file directly
    if (!selectedImageId) return null;
    const img = propertyImages.find((i) => i.id === selectedImageId);
    if (!img) return null;
    return getImageUrl(img as ImageRecord, "full");
  };

  const handleGenerate = async () => {
    if (!sdConfigured) {
      toast.error("Configure VITE_SD_URL para conectar ao Stable Diffusion.");
      return;
    }

    const hasBaseImage = !!uploadedFile || !!selectedImageId;
    const prompt = customPrompt || buildImagePrompt(formData);

    setLoading(true);
    try {
      let body: any;

      if (hasBaseImage) {
        let base64: string;
        if (uploadedFile) {
          base64 = await fileToBase64(uploadedFile);
        } else {
          const url = getSelectedImageUrl();
          if (!url) throw new Error("Imagem não encontrada.");
          base64 = await imageUrlToBase64(url);
        }

        body = {
          init_images: [base64],
          prompt,
          negative_prompt: "blurry, low quality, text, watermark, logo, distorted",
          steps: 20,
          cfg_scale: 7,
          denoising_strength: 0.5,
          width: 1024,
          height: 1024,
          sampler_name: "DPM++ 2M Karras",
        };

        const res = await fetch(`${SD_URL}/sdapi/v1/img2img`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Stable Diffusion error: ${res.status}`);
        const data = await res.json();
        const generated = `data:image/png;base64,${data.images[0]}`;
        onImageGenerated(generated);
      } else {
        body = {
          prompt,
          negative_prompt: "blurry, low quality, text, watermark, logo, distorted",
          steps: 20,
          cfg_scale: 7,
          width: 1024,
          height: 1024,
          sampler_name: "DPM++ 2M Karras",
        };

        const res = await fetch(`${SD_URL}/sdapi/v1/txt2img`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Stable Diffusion error: ${res.status}`);
        const data = await res.json();
        const generated = `data:image/png;base64,${data.images[0]}`;
        onImageGenerated(generated);
      }

      toast.success("Imagem gerada com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar imagem:", err);
      toast.error(
        err?.message?.includes("Failed to fetch")
          ? "Não foi possível conectar ao Stable Diffusion. Verifique VITE_SD_URL e CORS."
          : `Erro: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `anuncio-imagem-${Date.now()}.png`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ImagePlus className="h-5 w-5 text-primary" />
          Imagem do Anúncio
          {!sdConfigured && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (Configure VITE_SD_URL para habilitar)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Property image selector */}
        {propertyImages.length > 0 && (
          <div className="space-y-2">
            <Label>Selecione uma foto do imóvel como base</Label>
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
          <Label>Ou envie uma imagem manualmente</Label>
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

        {/* Custom prompt */}
        <div className="space-y-2">
          <Label>Prompt personalizado (opcional)</Label>
          <Textarea
            placeholder={buildImagePrompt(formData)}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Deixe vazio para gerar automaticamente com base nos dados do imóvel.
          </p>
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={loading || !sdConfigured}
          className="w-full sm:w-auto gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {loading ? "Gerando imagem..." : "Gerar Imagem"}
        </Button>

        {/* Loading skeleton */}
        {loading && !generatedImage && (
          <Skeleton className="w-full aspect-square max-w-md rounded-lg" />
        )}

        {/* Generated image preview */}
        {generatedImage && (
          <div className="space-y-3">
            <img
              src={generatedImage}
              alt="Imagem gerada para anúncio"
              className="w-full max-w-md rounded-lg border shadow-sm"
            />
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Baixar Imagem
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
