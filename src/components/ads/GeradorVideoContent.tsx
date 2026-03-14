import { useState, useEffect, useCallback } from "react";
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
  Video, Search, GripVertical, Download, Copy, RefreshCw,
  Loader2, X, Play, Clock, HardDrive, Check
} from "lucide-react";
import { cn } from "@/lib/utils";

// dnd-kit
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
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
        "relative aspect-square rounded-lg overflow-hidden border-2 group",
        isDragging && "opacity-50 z-50",
        photo.included ? "border-primary" : "border-muted opacity-60"
      )}
    >
      <img src={photo.url} alt="" className="w-full h-full object-cover" />
      <div className="absolute top-1 left-1 cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-white drop-shadow" />
      </div>
      <button
        type="button"
        onClick={() => onToggle(photo.id)}
        className={cn(
          "absolute top-1 right-1 h-5 w-5 rounded-full border-2 flex items-center justify-center text-xs",
          photo.included ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-muted-foreground"
        )}
      >
        {photo.included && <Check className="h-3 w-3" />}
      </button>
    </div>
  );
}

const PHASE_LABELS: Record<string, string> = {
  preparing_photos: "Preparando fotos...",
  generating_script: "Criando roteiro com IA...",
  generating_voice: "Gerando narração...",
  rendering_video: "Montando o vídeo...",
  uploading: "Finalizando...",
};

export default function GeradorVideoContent() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Step 1: Property selection
  const [propertySearch, setPropertySearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

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

  // Search properties
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-video-search", orgId, propertySearch],
    queryFn: async () => {
      if (!orgId) return [];
      let q = supabase.from("properties").select("id, title, address_neighborhood, address_city, sale_price, rent_price").eq("organization_id", orgId).limit(10);
      if (propertySearch.trim()) q = q.ilike("title", `%${propertySearch}%`);
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
        .select("*")
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

  const handleDragEnd = (event: DragEndEvent) => {
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

  // Polling
  useEffect(() => {
    if (!jobId || jobStatus?.status === "completed" || jobStatus?.status === "failed" || jobStatus?.status === "cancelled") return;

    const interval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await supabase.functions.invoke("video-job-status", {
          method: "GET",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: undefined,
        });

        // Use fetch directly for GET with query params
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-job-status?job_id=${jobId}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await response.json();

        setJobStatus(data);

        if (data.status === "completed") {
          toast.success("Vídeo gerado com sucesso!");
          queryClient.invalidateQueries({ queryKey: ["generated_videos"] });
          setIsGenerating(false);
        } else if (data.status === "failed") {
          toast.error(data.error || "Erro ao gerar o vídeo");
          setIsGenerating(false);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus?.status, queryClient]);

  // Generate
  const handleGenerate = async () => {
    if (includedPhotos.length < 3) {
      toast.error("Selecione pelo menos 3 fotos");
      return;
    }
    if (includedPhotos.length > 15) {
      toast.error("Máximo de 15 fotos");
      return;
    }

    setIsGenerating(true);
    setJobStatus(null);

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
      toast.error(err.message || "Erro ao iniciar geração");
      setIsGenerating(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await supabase.functions.invoke("cancel-video-job", { body: { job_id: jobId } });
      setJobStatus({ status: "cancelled", progress: 0, phase: "" });
      setIsGenerating(false);
      toast.info("Geração cancelada");
    } catch {
      toast.error("Erro ao cancelar");
    }
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

  return (
    <div className="space-y-6">
      {/* Step 1: Property + Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5" />
            Selecionar Imóvel e Fotos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Property search */}
          <div className="space-y-2">
            <Label>Buscar imóvel</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
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
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 text-sm transition-colors"
                    onClick={() => {
                      setSelectedPropertyId(p.id);
                      setPropertySearch(p.title || "");
                    }}
                  >
                    <span className="font-medium">{p.title}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {p.address_neighborhood} · {p.address_city}
                      {p.sale_price ? ` · R$ ${p.sale_price.toLocaleString("pt-BR")}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedPropertyId && (
              <Button variant="ghost" size="sm" onClick={() => { setSelectedPropertyId(null); setPropertySearch(""); setPhotos([]); }}>
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {photos.map((photo) => (
                      <SortablePhoto key={photo.id} photo={photo} onToggle={togglePhoto} />
                    ))}
                  </div>
                </SortableContext>
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
                <Label>Duração por foto</Label>
                <Select value={durationPerPhoto} onValueChange={setDurationPerPhoto}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 segundos</SelectItem>
                    <SelectItem value="3">3 segundos</SelectItem>
                    <SelectItem value="4">4 segundos</SelectItem>
                    <SelectItem value="5">5 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Formato</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9:16">Reels / TikTok (9:16)</SelectItem>
                    <SelectItem value="1:1">Feed / YouTube (1:1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Música de fundo</Label>
                <Select value={musicStyle} onValueChange={setMusicStyle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elegant">Suave e elegante</SelectItem>
                    <SelectItem value="dynamic">Dinâmica e moderna</SelectItem>
                    <SelectItem value="corporate">Corporativa</SelectItem>
                    <SelectItem value="none">Sem música</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Texto no frame final</Label>
                <Input
                  placeholder="Ex: Agende uma visita!"
                  value={finalText}
                  onChange={(e) => setFinalText(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-4 sm:col-span-2">
                <div className="flex items-center gap-3">
                  <Switch checked={hasNarration} onCheckedChange={setHasNarration} />
                  <Label>Narração em voz</Label>
                </div>
                {hasNarration && (
                  <Select value={voice} onValueChange={setVoice}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sofia">Sofia — Feminina natural</SelectItem>
                      <SelectItem value="lucas">Lucas — Masculino grave</SelectItem>
                      <SelectItem value="clara">Clara — Feminina jovem</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={includeLogo} onCheckedChange={setIncludeLogo} />
                <Label>Logo no vídeo</Label>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={handleGenerate} disabled={isGenerating || includedPhotos.length < 3 || includedPhotos.length > 15} size="lg">
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Video className="h-4 w-4 mr-2" />}
                Gerar Vídeo
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
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {PHASE_LABELS[jobStatus.phase || ""] || "Processando..."}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">~{estimatedMinutes} min restante{estimatedMinutes !== 1 ? "s" : ""}</span>
            </div>
            <Progress value={jobStatus.progress || 0} />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{jobStatus.progress || 0}%</span>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
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
              <Play className="h-5 w-5" /> Vídeo Gerado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg overflow-hidden bg-black max-w-xl mx-auto">
              <video src={jobStatus.video_url} controls className="w-full" />
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
            <div className="flex gap-2 justify-center">
              <Button asChild>
                <a href={jobStatus.video_url} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" /> Download MP4
                </a>
              </Button>
              <Button variant="outline" onClick={() => copyLink(jobStatus.video_url!)}>
                <Copy className="h-4 w-4 mr-2" /> Copiar link
              </Button>
              <Button variant="outline" onClick={() => { setJobId(null); setJobStatus(null); }}>
                <RefreshCw className="h-4 w-4 mr-2" /> Gerar nova versão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {jobStatus?.status === "failed" && (
        <Card className="border-destructive">
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-destructive font-medium">{jobStatus.error || "Erro ao gerar o vídeo"}</p>
            <Button variant="outline" onClick={() => { setJobId(null); setJobStatus(null); setIsGenerating(false); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimos vídeos gerados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {history.map((v: any) => (
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
                  </div>
                  {v.video_url && v.job_status === "completed" && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={v.video_url} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-3 w-3 mr-1" /> Download
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copyLink(v.video_url)}>
                        <Copy className="h-3 w-3 mr-1" /> Link
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
