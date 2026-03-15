import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ImagePlus, Download, Loader2, Upload, Check, Wand2,
  LayoutTemplate, Type, Sparkles, Bot, ChevronRight,
  RotateCcw, ArrowRight
} from "lucide-react";
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
type AiProvider = "openai" | "gemini" | "stability" | "leonardo" | "flux";

const PIPELINE_STEPS: { step: EditStyle; label: string; description: string; icon: React.ReactNode }[] = [
  { step: "enhance", label: "1. Melhorar foto", description: "Correção de cor, brilho e qualidade profissional", icon: <Wand2 className="h-4 w-4" /> },
  { step: "template", label: "2. Arte com moldura", description: "Moldura de marketing com layout profissional", icon: <LayoutTemplate className="h-4 w-4" /> },
  { step: "overlay", label: "3. Adicionar textos", description: "Sobrepor dados do imóvel (preço, área, etc.)", icon: <Type className="h-4 w-4" /> },
];

const AI_PROVIDER_OPTIONS: { value: AiProvider; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "openai", label: "OpenAI", description: "GPT Image-1 — alta qualidade", icon: <Sparkles className="h-4 w-4" /> },
  { value: "gemini", label: "Gemini", description: "Google Gemini — rápido e gratuito", icon: <Bot className="h-4 w-4" /> },
  { value: "stability", label: "Stability AI", description: "Stable Diffusion XL", icon: <Sparkles className="h-4 w-4" /> },
  { value: "leonardo", label: "Leonardo AI", description: "Especializado em produto — melhor custo", icon: <Sparkles className="h-4 w-4" /> },
  { value: "flux", label: "Flux Pro", description: "Qualidade premium (BFL)", icon: <Sparkles className="h-4 w-4" /> },
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
  const [style, setStyle] = useState<EditStyle>("enhance");
  const [aiProvider, setAiProvider] = useState<AiProvider>("openai");
  const [usePipeline, setUsePipeline] = useState(true);
  const [pipelineStep, setPipelineStep] = useState(0); // 0=enhance, 1=template, 2=overlay
  const [pipelineImages, setPipelineImages] = useState<string[]>([]); // results of each step
  const [processingStep, setProcessingStep] = useState<number | null>(null);
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
    resetPipeline();
  };

  const selectPropertyImage = (img: PropertyImage) => {
    setSelectedImageId(img.id);
    setUploadedFile(null);
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
      setUploadPreview(null);
    }
    resetPipeline();
  };

  const resetPipeline = () => {
    setPipelineStep(0);
    setPipelineImages([]);
    setProcessingStep(null);
  };

  const hasBaseImage = !!uploadedFile || !!selectedImageId;

  const getBaseImageUrl = async (): Promise<string> => {
    if (uploadedFile) {
      return fileToDataUrl(uploadedFile);
    }
    const img = propertyImages.find((i) => i.id === selectedImageId);
    if (!img) throw new Error("Imagem não encontrada.");
    return getImageUrl(img as ImageRecord, "full");
  };

  const executeStep = async (stepStyle: EditStyle, inputImageUrl: string) => {
    const overlayData = (stepStyle === "template" || stepStyle === "overlay") ? {
      title: formData.tipo ? `${formData.tipo} ${formData.finalidade ? `para ${formData.finalidade}` : ""}`.trim() : undefined,
      price: formatCurrency(formData.valor) || undefined,
      area: formData.metragem ? `${formData.metragem}m²` : undefined,
      bedrooms: formData.quartos ? `${formData.quartos} quartos` : undefined,
      parking: formData.vagas ? `${formData.vagas} vagas` : undefined,
      neighborhood: formData.bairro_cidade || undefined,
    } : undefined;

    const { data, error } = await supabase.functions.invoke("generate-ad-image", {
      body: {
        imageUrl: inputImageUrl,
        format,
        style: stepStyle,
        overlayData,
        customPrompt: customPrompt || undefined,
        aiProvider,
      },
    });

    if (error) throw new Error(error.message || "Erro ao gerar imagem.");
    if (data?.error) throw new Error(data.error);
    if (!data?.imageUrl) throw new Error("Nenhuma imagem retornada.");

    if (data.promptUsed) setLastPrompt(data.promptUsed);
    return data.imageUrl as string;
  };

  // Single step generation (non-pipeline or individual step)
  const handleGenerateSingle = async () => {
    if (!hasBaseImage) {
      toast.error("Selecione ou envie uma foto do imóvel.");
      return;
    }
    setLoading(true);
    try {
      const imageUrl = await getBaseImageUrl();
      const result = await executeStep(style, imageUrl);
      onImageGenerated(result);
      toast.success("Imagem gerada com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar imagem:", err);
      toast.error(err.message || "Erro ao gerar imagem. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Pipeline: execute next step
  const handlePipelineNext = async () => {
    if (!hasBaseImage) {
      toast.error("Selecione ou envie uma foto do imóvel.");
      return;
    }

    const currentStep = pipelineStep;
    setProcessingStep(currentStep);
    setLoading(true);

    try {
      // Get input: either last pipeline result, or original image
      let inputUrl: string;
      if (currentStep === 0) {
        inputUrl = await getBaseImageUrl();
      } else {
        inputUrl = pipelineImages[currentStep - 1];
        if (!inputUrl) throw new Error("Resultado da etapa anterior não encontrado.");
      }

      const stepStyle = PIPELINE_STEPS[currentStep].step;
      const result = await executeStep(stepStyle, inputUrl);

      const newImages = [...pipelineImages];
      newImages[currentStep] = result;
      setPipelineImages(newImages);
      onImageGenerated(result);

      // Advance to next step
      if (currentStep < PIPELINE_STEPS.length - 1) {
        setPipelineStep(currentStep + 1);
      }

      toast.success(`Etapa "${PIPELINE_STEPS[currentStep].label}" concluída!`);
    } catch (err: any) {
      console.error("Erro no pipeline:", err);
      toast.error(err.message || "Erro ao processar etapa.");
    } finally {
      setLoading(false);
      setProcessingStep(null);
    }
  };

  // Run all remaining pipeline steps
  const handlePipelineAll = async () => {
    if (!hasBaseImage) {
      toast.error("Selecione ou envie uma foto do imóvel.");
      return;
    }

    setLoading(true);
    try {
      let currentUrl = pipelineStep > 0 && pipelineImages[pipelineStep - 1]
        ? pipelineImages[pipelineStep - 1]
        : await getBaseImageUrl();

      const newImages = [...pipelineImages];

      for (let i = pipelineStep; i < PIPELINE_STEPS.length; i++) {
        setProcessingStep(i);
        const result = await executeStep(PIPELINE_STEPS[i].step, currentUrl);
        newImages[i] = result;
        currentUrl = result;
        onImageGenerated(result);
      }

      setPipelineImages(newImages);
      setPipelineStep(PIPELINE_STEPS.length - 1);
      toast.success("Pipeline completo! Todas as etapas processadas.");
    } catch (err: any) {
      console.error("Erro no pipeline:", err);
      toast.error(err.message || "Erro ao processar pipeline.");
    } finally {
      setLoading(false);
      setProcessingStep(null);
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
                    <img src={thumbUrl} alt="Foto do imóvel" className="w-full h-full object-cover" loading="lazy" />
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
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            {uploadPreview && (
              <img src={uploadPreview} alt="Upload preview" className="h-16 w-16 rounded-md object-cover border" />
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
        </div>

        {/* Mode toggle: Pipeline vs Single */}
        <div className="space-y-2">
          <Label>Modo de edição</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={usePipeline ? "default" : "outline"}
              size="sm"
              onClick={() => { setUsePipeline(true); resetPipeline(); }}
              className="gap-1.5"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Pipeline (3 etapas)
            </Button>
            <Button
              type="button"
              variant={!usePipeline ? "default" : "outline"}
              size="sm"
              onClick={() => setUsePipeline(false)}
              className="gap-1.5"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Edição única
            </Button>
          </div>
        </div>

        {/* Pipeline mode */}
        {usePipeline ? (
          <div className="space-y-4">
            {/* Pipeline steps visual */}
            <div className="space-y-2">
              <Label>Pipeline de edição</Label>
              <div className="flex flex-col gap-2">
                {PIPELINE_STEPS.map((ps, idx) => {
                  const isCompleted = !!pipelineImages[idx];
                  const isCurrent = idx === pipelineStep;
                  const isProcessing = processingStep === idx;
                  const isLocked = idx > pipelineStep && !isCompleted;

                  return (
                    <div key={ps.step} className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex items-center gap-3 flex-1 p-3 rounded-lg border-2 transition-all",
                          isProcessing ? "border-primary bg-primary/10 animate-pulse" :
                          isCompleted ? "border-green-500/50 bg-green-500/5" :
                          isCurrent ? "border-primary bg-primary/5" :
                          "border-border opacity-50"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                          isCompleted ? "bg-green-500 text-white" :
                          isCurrent ? "bg-primary text-primary-foreground" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> :
                           isCompleted ? <Check className="h-4 w-4" /> :
                           idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {ps.icon}
                            <span className="text-sm font-medium">{ps.label}</span>
                            {isCompleted && <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">Concluído</Badge>}
                            {isProcessing && <Badge className="text-[10px] animate-pulse">Processando...</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{ps.description}</p>
                        </div>
                        {/* Step thumbnail */}
                        {isCompleted && pipelineImages[idx] && (
                          <img
                            src={pipelineImages[idx]}
                            alt={`Resultado etapa ${idx + 1}`}
                            className="h-12 w-12 rounded border object-cover shrink-0 cursor-pointer hover:ring-2 ring-primary"
                            onClick={() => onImageGenerated(pipelineImages[idx])}
                          />
                        )}
                      </div>
                      {idx < PIPELINE_STEPS.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pipeline actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handlePipelineNext}
                disabled={loading || !hasBaseImage || pipelineStep >= PIPELINE_STEPS.length}
                className="gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : PIPELINE_STEPS[Math.min(pipelineStep, PIPELINE_STEPS.length - 1)]?.icon}
                {loading
                  ? `Processando ${PIPELINE_STEPS[processingStep ?? pipelineStep]?.label}...`
                  : pipelineStep >= PIPELINE_STEPS.length
                    ? "Pipeline concluído"
                    : `Executar: ${PIPELINE_STEPS[pipelineStep]?.label}`
                }
              </Button>

              {pipelineStep < PIPELINE_STEPS.length && (
                <Button
                  onClick={handlePipelineAll}
                  disabled={loading || !hasBaseImage}
                  variant="outline"
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Executar todas as etapas
                </Button>
              )}

              {pipelineImages.length > 0 && (
                <Button
                  onClick={() => { resetPipeline(); toast.info("Pipeline reiniciado."); }}
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Recomeçar
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Single edit mode */
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Estilo da edição</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PIPELINE_STEPS.map((opt) => (
                  <button
                    key={opt.step}
                    type="button"
                    onClick={() => setStyle(opt.step)}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
                      style === opt.step ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {opt.icon}
                      <span className="text-sm font-medium">{opt.label.replace(/^\d+\.\s*/, "")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleGenerateSingle} disabled={loading || !hasBaseImage} className="w-full sm:w-auto gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {loading ? "Processando imagem..." : "Gerar Imagem"}
            </Button>
          </div>
        )}

        {/* Format selection */}
        <div className="space-y-2">
          <Label>Formato de saída</Label>
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as OutputFormat)} className="flex gap-4">
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

        {/* AI Provider selection */}
        <div className="space-y-2">
          <Label>Modelo de IA</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {AI_PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAiProvider(opt.value)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
                  aiProvider === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
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
                <Button variant="ghost" size="sm" onClick={() => setShowPrompt(!showPrompt)} className="gap-2 text-muted-foreground">
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
