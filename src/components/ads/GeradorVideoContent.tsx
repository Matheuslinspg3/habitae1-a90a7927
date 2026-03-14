import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Video, Search, GripVertical, Download, Copy, RefreshCw,
  Loader2, X, Play, Clock, HardDrive, Check, Image as ImageIcon,
  Mic, Music, Film, Upload as UploadIcon, AlertTriangle, WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";

// dnd-kit
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PhotoItem {
  id: string;
  url: string;
  included: boolean;
}

function SortablePhoto({ photo, onToggle }: { photo: PhotoItem; onToggle: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden border-2 group transition-all",
        isDragging && "opacity-50 z-50 ring-2 ring-primary scale-105",
        photo.included ? "border-primary" : "border-muted opacity-60"
      )}
    >
      <img src={photo.url} alt="Foto do imóvel para vídeo" className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute top-1 left-1 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-white drop-shadow" />
      </div>
      <button
        type="button"
        onClick={() => onToggle(photo.id)}
        aria-label={photo.included ? "Excluir foto do vídeo" : "Incluir foto no vídeo"}
        className={cn(
          "absolute top-1 right-1 h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs transition-colors",
          photo.included ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-muted-foreground"
        )}
      >
        {photo.included && <Check className="h-3 w-3" />}
      </button>
    </div>
  );
}

const PHASE_CONFIG: Record<string, { label: string; icon: typeof Video }> = {
  preparing_photos: { label: "Preparando fotos...", icon: ImageIcon },
  generating_script: { label: "Criando roteiro com IA...", icon: Film },
  generating_voice: { label: "Gerando narração...", icon: Mic },
  rendering_video: { label: "Montando o vídeo...", icon: Video },
  uploading: { label: "Finalizando...", icon: UploadIcon },
};

export default function GeradorVideoContent() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Step 1: Property selection
  const [propertySearch, setPropertySearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Step 2: Config
  const [durationPerPhoto, setDurationPerPhoto] = useState("3");
  const [format, setFormat] = useState("9:16");
  const [hasNarration, setHasNarration] = useState(false);
  const [voice, setVoice] = useState("sofia");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [musicStyle, setMusicStyle] = useState("elegant");
  const [finalText, setFinalText] = useState("");

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<{
    status: string; progress: number; phase: string; video_url?: string;
    duration_seconds?: number; file_size_bytes?: number; error?: string;
  } | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [pollFailures, setPollFailures] = useState(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Debounced property search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(propertySearch), 300);
    return () => clearTimeout(timer);
  }, [propertySearch]);

  // Search properties
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-video-search", orgId, debouncedSearch],
    queryFn: async () => {
      if (!orgId) return [];
      let q = supabase.from("properties").select("id, title, address_neighborhood, address_city, sale_price, rent_price").eq("organization_id", orgId).limit(10);
      if (debouncedSearch.trim()) q = q.ilike("title", `%${debouncedSearch}%`);
      const { data } = await q;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Load images when property selected
  const { data: propertyImages = [] } = useQuery({
    queryKey: ["property-images-video", selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const { data } = await supabase
        .from("property_images")
        .select("id, url, display_order")
        .eq("property_id", selectedPropertyId)
        .order("display_order", { ascending: true });
      return data || [];
    },
    enabled: !!selectedPropertyId,
  });

  useEffect(() => {
    if (propertyImages.length > 0) {
      setPhotos(propertyImages.map((img) => ({ id: img.id, url: img.url, included: true })));
    }
  }, [propertyImages]);

  // History
  const { data: history = [] } = useQuery({
    queryKey: ["generated_videos", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("generated_videos")
        .select("id, job_status, format, duration_seconds, has_narration, video_url, created_at, file_size_bytes, photo_urls")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!orgId,
  });

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPhotos((prev) => {
        const oldIdx = prev.findIndex((p) => p.id === active.id);
        const newIdx = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const togglePhoto = (id: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, included: !p.included } : p)));
  };

  const includedPhotos = photos.filter((p) => p.included);
  const draggedPhoto = activeDragId ? photos.find((p) => p.id === activeDragId) : null;

  // Smooth progress interpolation
  useEffect(() => {
    const target = jobStatus?.progress || 0;
    if (displayProgress === target) return;

    const step = target > displayProgress ? 1 : 0;
    if (step === 0) {
      setDisplayProgress(target);
      return;
    }

    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= target) {
          clearInterval(interval);
          return target;
        }
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [jobStatus?.progress]);

  // Polling with failure tracking
  useEffect(() => {
    if (!jobId || jobStatus?.status === "completed" || jobStatus?.status === "failed" || jobStatus?.status === "cancelled") return;

    const interval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-job-status?job_id=${jobId}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await response.json();

        setPollFailures(0); // Reset on success
        setJobStatus(data);

        if (data.status === "completed") {
          toast.success("Vídeo gerado com sucesso!");
          queryClient.invalidateQueries({ queryKey: ["generated_videos"] });
          setIsGenerating(false);
        } else if (data.status === "failed") {
          toast.error(data.error || "Erro ao gerar o vídeo. Tente novamente.");
          setIsGenerating(false);
        }
      } catch {
        setPollFailures((prev) => prev + 1);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus?.status, queryClient]);

  // Generate
  const handleGenerate = async () => {
    if (includedPhotos.length < 3) {
      toast.error("Selecione pelo menos 3 fotos para gerar o vídeo.");
      return;
    }
    if (includedPhotos.length > 15) {
      toast.error("Máximo de 15 fotos permitido.");
      return;
    }

    setIsGenerating(true);
    setJobStatus(null);
    setDisplayProgress(0);
    setPollFailures(0);

    try {
      const { data, error } = await supabase.functions.invoke("generate-property-video", {
        body: {
          property_id: selectedPropertyId,
          photo_urls: includedPhotos.map((p) => p.url),
          duration_per_photo: parseInt(durationPerPhoto),
          format,
          has_narration: hasNarration,
          voice_used: voice,
          include_logo: includeLogo,
          music_style: musicStyle,
          final_text: finalText,
        },
      });

      if (error) throw error;
      setJobId(data.job_id);
      setJobStatus({ status: "processing", progress: 0, phase: "preparing_photos" });
      toast.info("Geração de vídeo iniciada!");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível iniciar a geração do vídeo. Tente novamente.");
      setIsGenerating(false);
    }
  };

  const handleCancelConfirm = async () => {
    setShowCancelDialog(false);
    if (!jobId) return;
    try {
      await supabase.functions.invoke("cancel-video-job", { body: { job_id: jobId } });
      setJobStatus({ status: "cancelled", progress: 0, phase: "" });
      setIsGenerating(false);
      toast.info("Geração cancelada.");
    } catch {
      toast.error("Não foi possível cancelar a geração.");
    }
  };

  const handleRetry = () => {
    // Preserves all config — just reset job state
    setJobId(null);
    setJobStatus(null);
    setIsGenerating(false);
    setDisplayProgress(0);
    setPollFailures(0);
  };

  const estimatedMinutes = jobStatus ? Math.max(1, Math.ceil(((100 - (jobStatus.progress || 0)) / 100) * (includedPhotos.length * parseInt(durationPerPhoto) * 0.3))) : 0;

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const firstPhotoUrl = includedPhotos[0]?.url;

  return (
    <div className="space-y-6">
      {/* Step 1: Property + Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5 text-primary" />
            Selecionar Imóvel e Fotos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Property search */}
          <div className="space-y-2">
            <Label htmlFor="video-property-search">Buscar imóvel</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="video-property-search"
                className="pl-9"
                placeholder="Digite o nome do imóvel..."
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
              />
            </div>
            {properties.length > 0 && !selectedPropertyId && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {properties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 text-sm transition-colors h-10"
                    onClick={() => {
                      setSelectedPropertyId(p.id);
                      setPropertySearch(p.title || "");
                    }}
                  >
                    <span className="font-medium">{p.title}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {p.address_neighborhood} · {p.address_city}
                      {p.sale_price ? ` · R$ ${Number(p.sale_price).toLocaleString("pt-BR")}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedPropertyId && (
              <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSelectedPropertyId(null); setPropertySearch(""); setPhotos([]); }}>
                <X className="h-3 w-3 mr-1" /> Trocar imóvel
              </Button>
            )}
          </div>

          {/* Photo grid with DnD */}
          {photos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fotos selecionadas ({includedPhotos.length}/15)</Label>
                {includedPhotos.length < 3 && (
                  <Badge variant="destructive" className="text-xs">Mínimo 3 fotos</Badge>
                )}
                {includedPhotos.length > 15 && (
                  <Badge variant="destructive" className="text-xs">Máximo 15 fotos</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Arraste para reordenar. Clique no círculo para incluir/excluir.</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {photos.map((photo) => (
                      <SortablePhoto key={photo.id} photo={photo} onToggle={togglePhoto} />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {draggedPhoto && (
                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-primary ring-2 ring-primary shadow-lg">
                      <img src={draggedPhoto.url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Config */}
      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurações do Vídeo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration-select">Duração por foto</Label>
                <Select value={durationPerPhoto} onValueChange={setDurationPerPhoto}>
                  <SelectTrigger id="duration-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 segundos</SelectItem>
                    <SelectItem value="3">3 segundos</SelectItem>
                    <SelectItem value="4">4 segundos</SelectItem>
                    <SelectItem value="5">5 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="format-select">Formato</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger id="format-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">Reels / TikTok (9:16)</SelectItem>
                    <SelectItem value="1:1">Feed / YouTube (1:1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="music-select">Música de fundo</Label>
                <Select value={musicStyle} onValueChange={setMusicStyle}>
                  <SelectTrigger id="music-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elegant">Suave e elegante</SelectItem>
                    <SelectItem value="dynamic">Dinâmica e moderna</SelectItem>
                    <SelectItem value="corporate">Corporativa</SelectItem>
                    <SelectItem value="none">Sem música</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="final-text-input">Texto no frame final</Label>
                <Input
                  id="final-text-input"
                  placeholder="Ex: Agende uma visita!"
                  value={finalText}
                  onChange={(e) => setFinalText(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-4 sm:col-span-2">
                <div className="flex items-center gap-3">
                  <Switch id="narration-switch" checked={hasNarration} onCheckedChange={setHasNarration} />
                  <Label htmlFor="narration-switch">Narração em voz</Label>
                </div>
                {hasNarration && (
                  <Select value={voice} onValueChange={setVoice}>
                    <SelectTrigger className="w-56" aria-label="Selecionar voz da narração"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sofia">Sofia — Feminina natural</SelectItem>
                      <SelectItem value="lucas">Lucas — Masculino grave</SelectItem>
                      <SelectItem value="clara">Clara — Feminina jovem</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Switch id="logo-switch" checked={includeLogo} onCheckedChange={setIncludeLogo} />
                <Label htmlFor="logo-switch">Logo no vídeo</Label>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || includedPhotos.length < 3 || includedPhotos.length > 15}
                size="lg"
                className="h-10 gap-2"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                {isGenerating ? "Gerando..." : "Gerar Vídeo"}
              </Button>
              <span className="text-xs text-muted-foreground">
                ~{includedPhotos.length * parseInt(durationPerPhoto)}s de vídeo
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {isGenerating && jobStatus && jobStatus.status !== "completed" && jobStatus.status !== "failed" && jobStatus.status !== "cancelled" && (
        <Card>
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const phaseConfig = PHASE_CONFIG[jobStatus.phase || ""] || { label: "Processando...", icon: Loader2 };
                  const PhaseIcon = phaseConfig.icon;
                  return (
                    <>
                      <PhaseIcon className={cn("h-4 w-4 text-primary", jobStatus.phase && "animate-pulse")} />
                      <span className="text-sm font-medium">{phaseConfig.label}</span>
                    </>
                  );
                })()}
              </div>
              <span className="text-xs text-muted-foreground">~{estimatedMinutes} min restante{estimatedMinutes !== 1 ? "s" : ""}</span>
            </div>
            <Progress value={displayProgress} className="transition-all duration-300" />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{displayProgress}%</span>
                {pollFailures >= 3 && (
                  <Badge variant="outline" className="gap-1 text-xs text-warning border-warning">
                    <WifiOff className="h-3 w-3" />
                    Verificando conexão...
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => setShowCancelDialog(true)}
                aria-label="Cancelar geração de vídeo"
              >
                <X className="h-3 w-3 mr-1" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {jobStatus?.status === "completed" && jobStatus.video_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" /> Vídeo Gerado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg overflow-hidden bg-black max-w-xl mx-auto">
              <video
                src={jobStatus.video_url}
                controls
                className="w-full"
                poster={firstPhotoUrl}
                preload="metadata"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-center">
              {jobStatus.duration_seconds && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" /> {jobStatus.duration_seconds}s
                </Badge>
              )}
              <Badge variant="secondary">{format === "9:16" ? "9:16 Reels" : "1:1 Feed"}</Badge>
              {jobStatus.file_size_bytes && (
                <Badge variant="secondary" className="gap-1">
                  <HardDrive className="h-3 w-3" /> {formatBytes(jobStatus.file_size_bytes)}
                </Badge>
              )}
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button asChild className="h-10 gap-2">
                <a href={jobStatus.video_url} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" /> Download MP4
                </a>
              </Button>
              <Button variant="outline" className="h-10 gap-2" onClick={() => copyLink(jobStatus.video_url!)}>
                <Copy className="h-4 w-4" /> Copiar link
              </Button>
              <Button variant="outline" className="h-10 gap-2" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4" /> Gerar nova versão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error - preserves config for retry */}
      {jobStatus?.status === "failed" && (
        <Card className="border-destructive">
          <CardContent className="py-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-destructive font-medium">
              {jobStatus.error || "Ocorreu um erro ao gerar o vídeo."}
            </p>
            <p className="text-sm text-muted-foreground">
              Suas configurações foram preservadas. Clique abaixo para tentar novamente.
            </p>
            <Button variant="outline" onClick={handleRetry} className="h-10 gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {(history as any[]).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos vídeos gerados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(history as any[]).map((v) => (
                <div key={v.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={v.job_status === "completed" ? "default" : v.job_status === "failed" ? "destructive" : "secondary"}>
                      {v.job_status === "completed" ? "Concluído" : v.job_status === "failed" ? "Erro" : v.job_status === "processing" ? "Processando" : v.job_status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{v.format === "9:16" ? "Reels" : "Feed"}</span>
                    {v.duration_seconds && <span>· {v.duration_seconds}s</span>}
                    {v.has_narration && <span>· Com narração</span>}
                    {v.file_size_bytes && <span>· {formatBytes(v.file_size_bytes)}</span>}
                  </div>
                  {v.video_url && v.job_status === "completed" && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-9 gap-1" asChild>
                        <a href={v.video_url} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3" /> Download
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => copyLink(v.video_url)}>
                        <Copy className="h-3 w-3" /> Link
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar geração?</DialogTitle>
            <DialogDescription>
              Tem certeza? O processamento será interrompido e o vídeo não será gerado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Continuar gerando
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm}>
              Cancelar geração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
