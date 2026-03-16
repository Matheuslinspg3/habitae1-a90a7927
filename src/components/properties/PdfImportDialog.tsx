import { useState, useRef, useCallback, useEffect } from "react";
import { toast as sonnerToast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Home,
  Ban,
  Camera,
  ChevronDown,
  ChevronUp,
  MapPin,
  Bed,
  Bath,
  Car,
  Ruler,
  Building2,
  User,
  Phone,
  Mail,
  DollarSign,
  Waves,
  Landmark,
  Package,
  ExternalLink,
  Pencil,
  ImageIcon,
  List,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, proxyDriveImageUrl } from "@/lib/utils";

export interface ExtractedPropertyData {
  unit_identifier?: string;
  property_type?: string;
  transaction_type: string;
  property_condition?: string;
  development_name?: string;
  sale_price?: number;
  sale_price_financed?: number;
  rent_price?: number;
  condominium_fee?: number;
  iptu?: number;
  bedrooms?: number;
  suites?: number;
  bathrooms?: number;
  parking_spots?: number;
  area_total?: number;
  area_built?: number;
  area_useful?: number;
  floor?: number;
  beach_distance_meters?: number;
  address_zipcode?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  description?: string;
  amenities?: string[];
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  is_sold?: boolean;
  is_reserved?: boolean;
  photos_url?: string;
}

interface PdfImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataExtracted: (data: ExtractedPropertyData, pdfFileName?: string) => void;
  onBatchExtracted?: (data: ExtractedPropertyData[], pdfFileName?: string) => void;
}

type Stage = "upload" | "extracting" | "preview" | "error";

interface ScrapedPhoto {
  url: string;
  thumbnail_url: string;
  file_id: string;
}

type FolderAccess = "public" | "private" | "not_found" | "checking" | "unknown";

export function PdfImportDialog({ open, onOpenChange, onDataExtracted, onBatchExtracted }: PdfImportDialogProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [extractedList, setExtractedList] = useState<ExtractedPropertyData[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [scrapedPhotosMap, setScrapedPhotosMap] = useState<Record<number, ScrapedPhoto[]>>({});
  const [scrapingIndices, setScrapingIndices] = useState<Set<number>>(new Set());
  const [folderAccessMap, setFolderAccessMap] = useState<Record<number, FolderAccess>>({});
  const [showNav, setShowNav] = useState(false);
  const propertyRefs = useRef<Record<number, HTMLDivElement | null>>({});
  // Stores subfolder info keyed by folder URL, so shared URLs are fetched only once
  const [subfoldersByUrl, setSubfoldersByUrl] = useState<Record<string, { id: string; name: string; imageCount: number }[]>>({});
  // Tracks which subfolder was matched to each property index
  const [subfolderMatchMap, setSubfolderMatchMap] = useState<Record<number, string | null>>({});

  const resetState = () => {
    setStage("upload");
    setFileName("");
    setExtractedList([]);
    setSelectedIndices(new Set());
    setErrorMessage("");
    setScrapedPhotosMap({});
    setScrapingIndices(new Set());
    setFolderAccessMap({});
    setShowNav(false);
    setSubfoldersByUrl({});
    setSubfolderMatchMap({});
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Increased limit to 50MB with the new processing pipeline
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite para processamento é 50MB.", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    setStage("extracting");

    const maxRetries = 2;
    let lastError = "";

    try {
      // Lazy-load pdf-lib to avoid loading it until needed
      const { compressPdf, splitPdfIntoChunks, uploadPdfToStorage, deletePdfFromStorage, formatFileSize } = await import("@/lib/pdfProcessor");

      // Method 1: Compress PDF
      sonnerToast.info("Otimizando PDF...", { id: "pdf-process" });
      const originalSize = file.size;
      const compressed = await compressPdf(file);
      const compressionRatio = ((1 - compressed.length / originalSize) * 100).toFixed(0);
      if (import.meta.env.DEV) console.log(`PDF compressed: ${formatFileSize(originalSize)} → ${formatFileSize(compressed.length)} (${compressionRatio}% reduction)`);

      // Method 3: Split into chunks if still large
      const CHUNK_LIMIT = 8 * 1024 * 1024; // 8MB per chunk
      let chunksToProcess: Uint8Array[];
      let totalPages = 0;

      if (compressed.length > CHUNK_LIMIT) {
        sonnerToast.info("Dividindo PDF em partes...", { id: "pdf-process" });
        const result = await splitPdfIntoChunks(file, 10);
        chunksToProcess = result.chunks;
        totalPages = result.totalPages;
        if (import.meta.env.DEV) console.log(`PDF split into ${chunksToProcess.length} chunks (${totalPages} pages total)`);
      } else {
        chunksToProcess = [compressed];
      }

      // Process each chunk
      const allProperties: ExtractedPropertyData[] = [];
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      for (let chunkIdx = 0; chunkIdx < chunksToProcess.length; chunkIdx++) {
        const chunk = chunksToProcess[chunkIdx];

        if (chunksToProcess.length > 1) {
          sonnerToast.info(`Processando parte ${chunkIdx + 1} de ${chunksToProcess.length}...`, { id: "pdf-process" });
        } else {
          sonnerToast.info("Extraindo dados com IA...", { id: "pdf-process" });
        }

        // Method 2: Upload to storage if chunk is large (> 5MB), otherwise send directly
        const USE_STORAGE_THRESHOLD = 5 * 1024 * 1024;
        let result: any;
        let storagePath: string | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            if (chunk.length > USE_STORAGE_THRESHOLD) {
              // Upload to storage and send URL to edge function
              const chunkName = chunksToProcess.length > 1
                ? `${file.name.replace(/\.pdf$/i, '')}_part${chunkIdx + 1}.pdf`
                : file.name;
              
              const { path, signedUrl } = await uploadPdfToStorage(supabase, chunk, chunkName);
              storagePath = path;

              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 180_000); // 3 min

              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-property-pdf`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    storage_url: signedUrl,
                    file_name: chunkName,
                    chunk_index: chunkIdx,
                    total_chunks: chunksToProcess.length,
                  }),
                  signal: controller.signal,
                }
              );
              clearTimeout(timeout);
              result = await response.json();

              if (!response.ok || !result.success) {
                const errorMsg = result.error || `Erro ${response.status}`;
                if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
                  lastError = errorMsg;
                  await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                  continue;
                }
                throw new Error(errorMsg);
              }
            } else {
              // Small chunk: send directly as FormData
              const formData = new FormData();
              const blob = new Blob([chunk.buffer as ArrayBuffer], { type: "application/pdf" });
              const chunkName = chunksToProcess.length > 1
                ? `${file.name.replace(/\.pdf$/i, '')}_part${chunkIdx + 1}.pdf`
                : file.name;
              formData.append("file", blob, chunkName);

              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 120_000);

              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-property-pdf`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: formData,
                  signal: controller.signal,
                }
              );
              clearTimeout(timeout);
              result = await response.json();

              if (!response.ok || !result.success) {
                const errorMsg = result.error || `Erro ${response.status}`;
                if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
                  lastError = errorMsg;
                  await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                  continue;
                }
                throw new Error(errorMsg);
              }
            }

            // Success - extract properties from this chunk
            const properties: ExtractedPropertyData[] = result.data?.properties
              ? result.data.properties
              : [result.data];
            allProperties.push(...properties);

            // Cleanup storage
            if (storagePath) {
              deletePdfFromStorage(supabase, storagePath).catch(() => {});
              storagePath = null;
            }

            break; // Success, exit retry loop
          } catch (err) {
            // Cleanup on error
            if (storagePath) {
              deletePdfFromStorage(supabase, storagePath).catch(() => {});
              storagePath = null;
            }

            if (err instanceof DOMException && err.name === "AbortError") {
              lastError = "Timeout: o processamento demorou demais.";
            } else {
              lastError = err instanceof Error ? err.message : "Erro desconhecido";
            }

            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
      }

      if (allProperties.length === 0) {
        throw new Error("Nenhum imóvel encontrado no documento");
      }

      setExtractedList(allProperties);
      const autoSelected = new Set<number>();
      allProperties.forEach((p, i) => {
        if (!p.is_sold && !p.is_reserved) autoSelected.add(i);
      });
      setSelectedIndices(autoSelected);
      setStage("preview");
      sonnerToast.success(`${allProperties.length} imóvel(is) extraído(s)!`, { id: "pdf-process" });

    } catch (err) {
      if (!lastError) {
        lastError = err instanceof Error ? err.message : "Erro desconhecido";
      }
      setErrorMessage(lastError);
      setStage("error");
      sonnerToast.error("Erro na extração", { id: "pdf-process" });
      toast({ title: "Erro na extração", description: lastError, variant: "destructive" });
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  // Helper: try to match a property to a subfolder by name
  const matchSubfolder = useCallback((item: ExtractedPropertyData, subfolders: { id: string; name: string; imageCount: number }[]): string | null => {
    if (!subfolders.length) return null;
    const candidates = [
      item.unit_identifier,
      item.development_name,
      item.address_complement,
    ].filter(Boolean).map(s => s!.trim().toUpperCase());

    if (!candidates.length) return null;

    // Try exact substring match
    for (const sub of subfolders) {
      const subName = sub.name.trim().toUpperCase();
      for (const c of candidates) {
        if (subName.includes(c) || c.includes(subName)) {
          return sub.id;
        }
      }
    }

    // Try numeric match (e.g. "AP 23" matches subfolder "23" or "Apt 23")
    const numbers = candidates.map(c => c.replace(/\D/g, "")).filter(n => n.length > 0);
    for (const sub of subfolders) {
      const subNumbers = sub.name.replace(/\D/g, "");
      if (subNumbers.length > 0 && numbers.includes(subNumbers)) {
        return sub.id;
      }
    }

    return null;
  }, []);

  // Proactively check folder access and fetch subfolders when properties are loaded
  useEffect(() => {
    if (stage !== "preview" || extractedList.length === 0) return;
    
    // Deduplicate: group properties by photos_url
    const urlToIndices: Record<string, number[]> = {};
    extractedList.forEach((item, idx) => {
      if (!item.photos_url) return;
      if (!urlToIndices[item.photos_url]) urlToIndices[item.photos_url] = [];
      urlToIndices[item.photos_url].push(idx);
    });

    Object.entries(urlToIndices).forEach(async ([photosUrl, indices]) => {
      // Skip if already checked
      if (indices.every(idx => folderAccessMap[idx] && folderAccessMap[idx] !== "checking")) return;
      
      indices.forEach(idx => {
        setFolderAccessMap(prev => prev[idx] ? prev : { ...prev, [idx]: "checking" });
      });

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-drive-photos`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: photosUrl, check_access: true }),
          }
        );
        const result = await resp.json();
        const access = result.access || "unknown";
        
        indices.forEach(idx => {
          setFolderAccessMap(prev => ({ ...prev, [idx]: access }));
        });

        // Store subfolders for per-property matching
        if (access === "public" && result.subfolders?.length > 0) {
          console.log(`Folder has ${result.subfolders.length} subfolders:`, result.subfolders.map((s: any) => s.name));
          setSubfoldersByUrl(prev => ({ ...prev, [photosUrl]: result.subfolders }));
          
          // Auto-match subfolders when URL is shared among multiple properties
          if (indices.length > 1) {
            indices.forEach(idx => {
              const matched = matchSubfolder(extractedList[idx], result.subfolders);
              console.log(`Property ${idx} (${extractedList[idx].unit_identifier || 'no id'}): matched subfolder = ${matched || 'none'}`);
              setSubfolderMatchMap(prev => ({ ...prev, [idx]: matched }));
            });
          }
        }
      } catch {
        indices.forEach(idx => {
          setFolderAccessMap(prev => ({ ...prev, [idx]: "unknown" }));
        });
      }
    });
  }, [stage, extractedList, matchSubfolder]);

  // Scrape Drive photos for a specific property (triggered on expand)
  const scrapePhotosForProperty = useCallback(async (idx: number, photosUrl: string) => {
    if (scrapedPhotosMap[idx] || scrapingIndices.has(idx)) return;
    if (folderAccessMap[idx] === "private") return;
    setScrapingIndices(prev => new Set(prev).add(idx));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if this URL is shared among multiple properties
      const isSharedUrl = extractedList.filter(p => p.photos_url === photosUrl).length > 1;
      const matchedSubfolderId = subfolderMatchMap[idx];
      
      let scrapeUrl = photosUrl;
      
      if (isSharedUrl && matchedSubfolderId) {
        // Scrape the specific matched subfolder
        scrapeUrl = `https://drive.google.com/drive/folders/${matchedSubfolderId}`;
        console.log(`Property ${idx}: scraping matched subfolder ${matchedSubfolderId}`);
      } else if (isSharedUrl && !matchedSubfolderId) {
        // Shared URL but no name match - try using subfolders by index order
        const subfolders = subfoldersByUrl[photosUrl];
        if (subfolders && subfolders.length > 0) {
          const propIndicesWithSameUrl = extractedList
            .map((p, i) => p.photos_url === photosUrl ? i : -1)
            .filter(i => i >= 0);
          const positionInGroup = propIndicesWithSameUrl.indexOf(idx);
          if (positionInGroup >= 0 && positionInGroup < subfolders.length) {
            scrapeUrl = `https://drive.google.com/drive/folders/${subfolders[positionInGroup].id}`;
            console.log(`Property ${idx}: no name match, using subfolder by position: "${subfolders[positionInGroup].name}"`);
          }
        }
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-drive-photos`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: scrapeUrl, max_photos: 20 }),
        }
      );
      const result = await resp.json();
      if (result.access === "private") {
        setFolderAccessMap(prev => ({ ...prev, [idx]: "private" }));
      } else if (result.success && result.photos?.length > 0) {
        setScrapedPhotosMap(prev => ({ ...prev, [idx]: result.photos }));
        setFolderAccessMap(prev => ({ ...prev, [idx]: "public" }));
      }
    } catch (err) {
      console.error(`Error scraping photos for property ${idx}:`, err);
    } finally {
      setScrapingIndices(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }, [scrapedPhotosMap, scrapingIndices, folderAccessMap, subfolderMatchMap, subfoldersByUrl, extractedList]);

  const toggleIndex = useCallback((idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const updateItem = useCallback((idx: number, updates: Partial<ExtractedPropertyData>) => {
    setExtractedList(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  }, []);

  const selectAll = () => setSelectedIndices(new Set(extractedList.map((_, i) => i)));
  const deselectAll = () => setSelectedIndices(new Set());

  const scrollToProperty = (idx: number) => {
    propertyRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleConfirm = () => {
    const selected = extractedList.filter((_, i) => selectedIndices.has(i));
    if (selected.length === 0) return;

    const pdfName = fileName.replace(/\.pdf$/i, "");

    if (selected.length === 1 && !onBatchExtracted) {
      onDataExtracted(selected[0], pdfName);
    } else if (onBatchExtracted) {
      onBatchExtracted(selected, pdfName);
    } else {
      onDataExtracted(selected[0], pdfName);
    }
    handleOpenChange(false);
  };

  const fmtCurrency = (val?: number) =>
    val != null ? `R$ ${val.toLocaleString("pt-BR")}` : null;

  const isBatch = extractedList.length > 1;
  const photosCount = extractedList.filter(p => p.photos_url).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(
        "max-w-lg",
        stage === "preview" && "max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Imóveis via PDF
          </DialogTitle>
          <DialogDescription>
            Envie um PDF e a IA extrairá os dados. Você pode editar cada campo antes de importar.
          </DialogDescription>
        </DialogHeader>

        {stage === "upload" && (
          <label
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer",
              "hover:border-primary/60 hover:bg-muted/50 transition-colors"
            )}
          >
            <FileUp className="h-10 w-10 text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center">
              Clique ou arraste um arquivo PDF aqui
            </span>
            <span className="text-xs text-muted-foreground">Máximo 50MB • Compressão automática</span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        )}

        {stage === "extracting" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analisando documento...</p>
              <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
            </div>
          </div>
        )}

        {stage === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-destructive text-center">{errorMessage}</p>
            <Button variant="outline" onClick={resetState}>Tentar novamente</Button>
          </div>
        )}

        {stage === "preview" && extractedList.length > 0 && (
          <div className="flex flex-col gap-3 min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">
                  {extractedList.length} {extractedList.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}
                </span>
                {photosCount > 0 && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Camera className="h-3 w-3" />
                    {photosCount} com fotos
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {isBatch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => setShowNav(!showNav)}
                  >
                    <List className="h-3.5 w-3.5" />
                    {showNav ? "Ocultar índice" : "Índice"}
                  </Button>
                )}
                {isBatch && (
                  <>
                    <Button variant="ghost" size="sm" onClick={selectAll}>Selecionar todos</Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}>Limpar</Button>
                  </>
                )}
              </div>
            </div>

            {/* Main content with optional side nav */}
            <div className="flex gap-3 min-h-0 flex-1 overflow-hidden">
              {/* Side navigation */}
              {showNav && isBatch && (
                <div className="w-48 shrink-0 border rounded-lg overflow-y-auto bg-muted/30">
                  <div className="p-2 space-y-0.5">
                    {extractedList.map((item, idx) => {
                      const navLabel = item.unit_identifier || item.property_type || `Imóvel ${idx + 1}`;
                      return (
                        <button
                          key={idx}
                          onClick={() => scrollToProperty(idx)}
                          className={cn(
                            "w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors truncate",
                            "hover:bg-accent hover:text-accent-foreground",
                            selectedIndices.has(idx) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                          )}
                        >
                          <span className="font-mono mr-1.5 text-[10px]">{idx + 1}.</span>
                          {navLabel}
                          {item.is_sold && <span className="ml-1 text-destructive">✕</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Property list - native scroll */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
                {extractedList.map((item, idx) => (
                  <div
                    key={idx}
                    ref={(el) => { propertyRefs.current[idx] = el; }}
                  >
                    <PropertyPreviewRow
                      item={item}
                      index={idx}
                      selected={selectedIndices.has(idx)}
                      onToggle={() => toggleIndex(idx)}
                      onUpdate={(updates) => updateItem(idx, updates)}
                      showCheckbox={isBatch}
                      formatCurrency={fmtCurrency}
                      scrapedPhotos={scrapedPhotosMap[idx]}
                      isScrapingPhotos={scrapingIndices.has(idx)}
                      folderAccess={folderAccessMap[idx]}
                      onExpand={() => {
                        if (item.photos_url) {
                          scrapePhotosForProperty(idx, item.photos_url);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Pencil className="h-3 w-3" />
              Clique em "Editar" para ajustar os dados antes de importar.
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetState}>Novo arquivo</Button>
              <Button onClick={handleConfirm} disabled={selectedIndices.size === 0}>
                {isBatch
                  ? `Importar ${selectedIndices.size} ${selectedIndices.size === 1 ? "imóvel" : "imóveis"}`
                  : "Usar estes dados"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Editable Field ──
function EditableField({
  label, value, onChange, type = "text", placeholder, icon: Icon,
}: {
  label: string;
  value: string | number | undefined | null;
  onChange: (val: string) => void;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const displayValue = value != null ? String(value) : "";
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </label>
      {type === "textarea" ? (
        <Textarea
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm min-h-[60px]"
        />
      ) : (
        <Input
          type={type}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}

// ── Read-only Detail Item ──
function DetailItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium">{value}</span>
      </div>
    </div>
  );
}

// ── Helper: normalize Google Drive folder URL for direct browser access ──
function normalizeDriveFolderUrl(url: string): string {
  const folderMatch = url.match(/(?:folders\/|folderview\?id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    const folderId = folderMatch[1];
    return `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;
  }
  if (url.startsWith("http")) return url;
  return url;
}

// ── Expandable Property Preview Row ──
function PropertyPreviewRow({
  item, index, selected, onToggle, onUpdate, showCheckbox, formatCurrency, scrapedPhotos, isScrapingPhotos, folderAccess, onExpand,
}: {
  item: ExtractedPropertyData;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<ExtractedPropertyData>) => void;
  showCheckbox: boolean;
  formatCurrency: (v?: number) => string | null;
  scrapedPhotos?: ScrapedPhoto[];
  isScrapingPhotos?: boolean;
  folderAccess?: FolderAccess;
  onExpand?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const isSoldOrReserved = item.is_sold || item.is_reserved;

  const label = [
    item.unit_identifier,
    item.property_type,
  ].filter(Boolean).join(" — ") || "Imóvel";

  const location = [item.address_neighborhood, item.address_city].filter(Boolean).join(", ");
  const price = formatCurrency(item.sale_price) || formatCurrency(item.rent_price);

  const quickDetails = [
    item.bedrooms != null ? `${item.bedrooms}q` : null,
    item.suites != null && item.suites > 0 ? `${item.suites}s` : null,
    item.area_total ? `${item.area_total}m²` : null,
    item.parking_spots != null ? `${item.parking_spots}v` : null,
  ].filter(Boolean).join(" · ");

  const fullAddress = [
    item.address_street, item.address_number, item.address_complement,
    item.address_neighborhood, item.address_city, item.address_state, item.address_zipcode,
  ].filter(Boolean).join(", ");

  const hasOwner = item.owner_name || item.owner_phone || item.owner_email;
  const hasExtras = item.floor || item.beach_distance_meters || item.property_condition || item.amenities?.length;

  const setNum = (field: keyof ExtractedPropertyData) => (val: string) => {
    onUpdate({ [field]: val === "" ? undefined : Number(val) });
  };
  const setStr = (field: keyof ExtractedPropertyData) => (val: string) => {
    onUpdate({ [field]: val || undefined });
  };

  // Each property gets its own scoped photos URL
  const photosHref = item.photos_url ? normalizeDriveFolderUrl(item.photos_url) : undefined;

  const handleToggleExpand = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && onExpand) {
      onExpand();
    }
  };

  return (
    <Collapsible open={expanded} onOpenChange={(o) => { setExpanded(o); if (o && onExpand) onExpand(); }}>
      <Card
        className={cn(
          "transition-colors",
          selected && "ring-2 ring-primary",
          isSoldOrReserved && "opacity-60"
        )}
      >
        <CardContent className="p-3 space-y-0">
          {/* Header row */}
          <div className="flex items-start gap-3 cursor-pointer" onClick={onToggle}>
            {showCheckbox && (
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggle()}
                className="mt-0.5"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm truncate">{label}</span>
                {item.development_name && (
                  <Badge variant="outline" className="text-xs">{item.development_name}</Badge>
                )}
                {item.photos_url && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Camera className="h-3 w-3" />
                    {scrapedPhotos?.length ? `${scrapedPhotos.length} fotos` : "Fotos"}
                  </Badge>
                )}
                {item.photos_url && folderAccess === "private" && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    🔒 Pasta privada
                  </Badge>
                )}
                {item.photos_url && folderAccess === "checking" && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verificando
                  </Badge>
                )}
                {item.is_sold && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <Ban className="h-3 w-3" /> Vendido
                  </Badge>
                )}
                {item.is_reserved && (
                  <Badge variant="secondary" className="text-xs">Reservado</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {price && <span className="font-medium text-foreground">{price}</span>}
                {quickDetails && <span>{quickDetails}</span>}
                {location && <span>{location}</span>}
              </div>
            </div>

            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={(e) => { e.stopPropagation(); handleToggleExpand(); }}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Expanded details */}
          <CollapsibleContent>
            <Separator className="my-3" />

            {/* Toggle edit mode */}
            <div className="flex justify-end mb-3">
              <Button
                variant={editing ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setEditing(!editing)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {editing ? "Concluir edição" : "Editar"}
              </Button>
            </div>

            {editing ? (
              /* ── EDIT MODE ── */
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Identificação</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <EditableField label="Identificador" value={item.unit_identifier} onChange={setStr("unit_identifier")} icon={Home} placeholder="Ex: Unidade 101" />
                    <EditableField label="Tipo" value={item.property_type} onChange={setStr("property_type")} icon={Building2} placeholder="Ex: Apartamento" />
                    <EditableField label="Empreendimento" value={item.development_name} onChange={setStr("development_name")} icon={Landmark} placeholder="Nome do empreendimento" />
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Transação
                      </label>
                      <Select value={item.transaction_type || "venda"} onValueChange={(v) => onUpdate({ transaction_type: v })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="venda">Venda</SelectItem>
                          <SelectItem value="aluguel">Aluguel</SelectItem>
                          <SelectItem value="ambos">Ambos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Condição
                      </label>
                      <Select value={item.property_condition || ""} onValueChange={(v) => onUpdate({ property_condition: v || undefined })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="usado">Usado</SelectItem>
                          <SelectItem value="na_planta">Na planta</SelectItem>
                          <SelectItem value="em_construcao">Em construção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Características</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <EditableField label="Quartos" value={item.bedrooms} onChange={setNum("bedrooms")} type="number" icon={Bed} />
                    <EditableField label="Suítes" value={item.suites} onChange={setNum("suites")} type="number" icon={Bed} />
                    <EditableField label="Banheiros" value={item.bathrooms} onChange={setNum("bathrooms")} type="number" icon={Bath} />
                    <EditableField label="Vagas" value={item.parking_spots} onChange={setNum("parking_spots")} type="number" icon={Car} />
                    <EditableField label="Área total (m²)" value={item.area_total} onChange={setNum("area_total")} type="number" icon={Ruler} />
                    <EditableField label="Área construída (m²)" value={item.area_built} onChange={setNum("area_built")} type="number" icon={Ruler} />
                    <EditableField label="Área útil (m²)" value={item.area_useful} onChange={setNum("area_useful")} type="number" icon={Ruler} />
                    <EditableField label="Andar" value={item.floor} onChange={setNum("floor")} type="number" icon={Building2} />
                    <EditableField label="Distância praia (m)" value={item.beach_distance_meters} onChange={setNum("beach_distance_meters")} type="number" icon={Waves} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Valores</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <EditableField label="Preço venda" value={item.sale_price} onChange={setNum("sale_price")} type="number" icon={DollarSign} />
                    <EditableField label="Preço financiado" value={item.sale_price_financed} onChange={setNum("sale_price_financed")} type="number" icon={DollarSign} />
                    <EditableField label="Aluguel" value={item.rent_price} onChange={setNum("rent_price")} type="number" icon={DollarSign} />
                    <EditableField label="Condomínio" value={item.condominium_fee} onChange={setNum("condominium_fee")} type="number" icon={DollarSign} />
                    <EditableField label="IPTU" value={item.iptu} onChange={setNum("iptu")} type="number" icon={Landmark} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Localização</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <EditableField label="Rua" value={item.address_street} onChange={setStr("address_street")} icon={MapPin} />
                    <EditableField label="Número" value={item.address_number} onChange={setStr("address_number")} icon={MapPin} />
                    <EditableField label="Complemento" value={item.address_complement} onChange={setStr("address_complement")} icon={MapPin} />
                    <EditableField label="Bairro" value={item.address_neighborhood} onChange={setStr("address_neighborhood")} icon={MapPin} />
                    <EditableField label="Cidade" value={item.address_city} onChange={setStr("address_city")} icon={MapPin} />
                    <EditableField label="Estado" value={item.address_state} onChange={setStr("address_state")} icon={MapPin} />
                    <EditableField label="CEP" value={item.address_zipcode} onChange={setStr("address_zipcode")} icon={MapPin} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Proprietário</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <EditableField label="Nome" value={item.owner_name} onChange={setStr("owner_name")} icon={User} />
                    <EditableField label="Telefone" value={item.owner_phone} onChange={setStr("owner_phone")} icon={Phone} />
                    <EditableField label="E-mail" value={item.owner_email} onChange={setStr("owner_email")} icon={Mail} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Descrição</p>
                  <EditableField label="" value={item.description} onChange={setStr("description")} type="textarea" placeholder="Descrição do imóvel..." />
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Link de fotos</p>
                  <EditableField label="" value={item.photos_url} onChange={setStr("photos_url")} icon={Camera} placeholder="URL da pasta de fotos (Google Drive, etc.)" />
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Características</p>
                  <DetailItem icon={Building2} label="Tipo" value={item.property_type} />
                  <DetailItem icon={Bed} label="Quartos" value={item.bedrooms != null ? item.bedrooms : undefined} />
                  <DetailItem icon={Bed} label="Suítes" value={item.suites != null && item.suites > 0 ? item.suites : undefined} />
                  <DetailItem icon={Bath} label="Banheiros" value={item.bathrooms != null ? item.bathrooms : undefined} />
                  <DetailItem icon={Car} label="Vagas" value={item.parking_spots != null ? item.parking_spots : undefined} />
                  <DetailItem icon={Ruler} label="Área total" value={item.area_total ? `${item.area_total} m²` : undefined} />
                  <DetailItem icon={Ruler} label="Área construída" value={item.area_built ? `${item.area_built} m²` : undefined} />
                  <DetailItem icon={Ruler} label="Área útil" value={item.area_useful ? `${item.area_useful} m²` : undefined} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valores</p>
                  <DetailItem icon={DollarSign} label="Venda" value={formatCurrency(item.sale_price)} />
                  <DetailItem icon={DollarSign} label="Financiado" value={formatCurrency(item.sale_price_financed)} />
                  <DetailItem icon={DollarSign} label="Aluguel" value={formatCurrency(item.rent_price)} />
                  <DetailItem icon={DollarSign} label="Condomínio" value={formatCurrency(item.condominium_fee)} />
                  <DetailItem icon={Landmark} label="IPTU" value={formatCurrency(item.iptu)} />
                </div>

                {fullAddress && (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Localização</p>
                    <DetailItem icon={MapPin} label="Endereço" value={fullAddress} />
                  </div>
                )}

                {hasOwner && (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proprietário</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <DetailItem icon={User} label="Nome" value={item.owner_name} />
                      <DetailItem icon={Phone} label="Telefone" value={item.owner_phone} />
                      <DetailItem icon={Mail} label="E-mail" value={item.owner_email} />
                    </div>
                  </div>
                )}

                {hasExtras && (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalhes extras</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <DetailItem icon={Building2} label="Andar" value={item.floor} />
                      <DetailItem icon={Waves} label="Distância da praia" value={item.beach_distance_meters ? `${item.beach_distance_meters}m` : undefined} />
                      <DetailItem icon={Package} label="Condição" value={
                        item.property_condition === "novo" ? "Novo" :
                        item.property_condition === "usado" ? "Usado" :
                        item.property_condition === "na_planta" ? "Na planta" :
                        item.property_condition === "em_construcao" ? "Em construção" :
                        item.property_condition
                      } />
                    </div>
                  </div>
                )}

                {item.amenities && item.amenities.length > 0 && (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comodidades</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.amenities.map((a, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {item.description && (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                )}

                {/* Photos section - scoped to THIS property only */}
                {(item.photos_url || scrapedPhotos?.length || isScrapingPhotos) && (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fotos</p>

                    {/* Private folder warning */}
                    {folderAccess === "private" && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        <div>
                          <span className="font-medium text-destructive">Pasta privada</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Peça ao proprietário para compartilhar a pasta com "Qualquer pessoa com o link" no Google Drive.
                          </p>
                        </div>
                      </div>
                    )}

                    {item.photos_url && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (photosHref) {
                              const w = window.open(photosHref, '_blank', 'noopener,noreferrer');
                              if (!w) {
                                navigator.clipboard.writeText(photosHref);
                                sonnerToast.info("Pop-up bloqueado. Link copiado — cole no navegador.");
                              }
                            }
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir pasta de fotos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (photosHref) {
                              navigator.clipboard.writeText(photosHref);
                              sonnerToast.success("Link copiado!");
                            }
                          }}
                        >
                          Copiar link
                        </Button>
                      </div>
                    )}

                    {/* Loading state */}
                    {isScrapingPhotos && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando fotos da pasta...
                      </div>
                    )}

                    {/* Thumbnail grid */}
                    {scrapedPhotos && scrapedPhotos.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {scrapedPhotos.length} {scrapedPhotos.length === 1 ? "foto encontrada" : "fotos encontradas"}
                        </p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                          {scrapedPhotos.map((photo, i) => (
                            <PhotoThumbnail key={photo.file_id} photo={photo} index={i} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

// ── Photo Thumbnail with loading state ──
function PhotoThumbnail({ photo, index }: { photo: ScrapedPhoto; index: number }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [urlIndex, setUrlIndex] = useState(0);

  // Multiple URL strategies - try direct Google CDN first, then proxy
  const urls = [
    `https://lh3.googleusercontent.com/d/${photo.file_id}=w400`,
    `https://drive.google.com/thumbnail?id=${photo.file_id}&sz=w400`,
    proxyDriveImageUrl(`https://drive.google.com/thumbnail?id=${photo.file_id}&sz=w400`, "w400"),
  ];

  const handleError = () => {
    if (urlIndex < urls.length - 1) {
      setUrlIndex(prev => prev + 1);
      setStatus("loading");
    } else {
      setStatus("error");
    }
  };

  return (
    <div className="aspect-square rounded-md overflow-hidden border bg-muted relative">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <img
        src={urls[urlIndex]}
        alt={`Foto ${index + 1}`}
        className={cn(
          "w-full h-full object-cover transition-opacity",
          status === "loaded" ? "opacity-100" : "opacity-0"
        )}
        loading="lazy"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onLoad={(e) => {
          const img = e.currentTarget;
          // Check if it's a valid image (not a tiny placeholder)
          if (img.naturalWidth > 10 && img.naturalHeight > 10) {
            setStatus("loaded");
          } else {
            handleError();
          }
        }}
        onError={handleError}
      />
    </div>
  );
}
