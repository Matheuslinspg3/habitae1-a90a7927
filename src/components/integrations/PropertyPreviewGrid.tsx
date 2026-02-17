import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Loader2, 
  Home, 
  MapPin, 
  BedDouble, 
  Bath,
  Maximize,
  Car,
  XCircle
} from "lucide-react";
import type { ImobziPropertyPreview } from "@/hooks/useImobziImport";
import { MarketplacePublishDialog } from "./MarketplacePublishDialog";

interface PropertyPreviewGridProps {
  properties: ImobziPropertyPreview[];
  isLoading: boolean;
  isProcessing: boolean;
  processingProgress: { current: number; total: number };
  onProcess: (selectedIds: string[], marketplaceIds: string[]) => void;
  onCancel?: () => void;
}

export function PropertyPreviewGrid({
  properties,
  isLoading,
  isProcessing,
  processingProgress,
  onProcess,
  onCancel,
}: PropertyPreviewGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMarketplaceDialog, setShowMarketplaceDialog] = useState(false);

  const allSelected = useMemo(
    () => properties.length > 0 && selectedIds.size === properties.length,
    [properties.length, selectedIds.size]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(properties.map((p) => p.property_id)));
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Buscando imóveis...</p>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Home className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Nenhum imóvel encontrado</p>
        <p className="text-sm">Clique em "Sincronizar" para buscar os imóveis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            id="select-all"
          />
          <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </label>
          <Badge variant="secondary">{selectedIds.size} selecionado(s)</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowMarketplaceDialog(true)}
            disabled={selectedIds.size === 0 || isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Importar Selecionados
              </>
            )}
          </Button>
          
          {isProcessing && onCancel && (
            <Button
              variant="destructive"
              onClick={onCancel}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Processing progress */}
      {isProcessing && processingProgress.total > 0 && (
        <div className="p-4 bg-primary/10 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Processando imóveis...</span>
            <span className="font-medium">
              {processingProgress.current} / {processingProgress.total}
            </span>
          </div>
          <Progress
            value={(processingProgress.current / processingProgress.total) * 100}
            className="h-2"
          />
        </div>
      )}

      {/* Properties grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {properties.map((property) => (
          <div
            key={property.property_id}
            className={`relative group rounded-lg border overflow-hidden transition-all duration-200 ${
              selectedIds.has(property.property_id)
                ? 'ring-2 ring-primary border-primary'
                : 'hover:border-primary/50'
            }`}
          >
            {/* Checkbox */}
            <div className="absolute top-3 left-3 z-10">
              <Checkbox
                checked={selectedIds.has(property.property_id)}
                onCheckedChange={() => toggleSelect(property.property_id)}
                className="bg-background/80 backdrop-blur-sm"
              />
            </div>

            {/* Cover image */}
            <div 
              className="aspect-video bg-muted cursor-pointer"
              onClick={() => toggleSelect(property.property_id)}
            >
              {property.cover_photo ? (
                <img
                  src={property.cover_photo}
                  alt={property.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Home className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
            </div>

            {/* Info */}
            <div 
              className="p-3 space-y-2 cursor-pointer"
              onClick={() => toggleSelect(property.property_id)}
            >
              {/* Code badge */}
              {property.code && (
                <Badge variant="outline" className="text-xs mb-1">
                  Cód: {property.code}
                </Badge>
              )}
              
              <h3 className="font-medium line-clamp-1">{property.title}</h3>
              
              {(property.address_city || property.address_neighborhood) && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {[property.address_neighborhood, property.address_city]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                {(property.bedrooms !== undefined && property.bedrooms > 0) && (
                  <span className="flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" />
                    {property.bedrooms}
                  </span>
                )}
                {(property.bathrooms !== undefined && property.bathrooms > 0) && (
                  <span className="flex items-center gap-1">
                    <Bath className="h-3.5 w-3.5" />
                    {property.bathrooms}
                  </span>
                )}
                {(property.parking_spots !== undefined && property.parking_spots > 0) && (
                  <span className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" />
                    {property.parking_spots}
                  </span>
                )}
                {(property.area_total !== undefined && property.area_total > 0) && (
                  <span className="flex items-center gap-1">
                    <Maximize className="h-3.5 w-3.5" />
                    {property.area_total.toFixed(0)}m²
                  </span>
                )}
              </div>

              {(property.sale_price || property.rent_price) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {property.sale_price && property.sale_price > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Venda: {formatPrice(property.sale_price)}
                    </Badge>
                  )}
                  {property.rent_price && property.rent_price > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Aluguel: {formatPrice(property.rent_price)}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <MarketplacePublishDialog
        open={showMarketplaceDialog}
        onOpenChange={setShowMarketplaceDialog}
        selectedProperties={properties.filter((p) => selectedIds.has(p.property_id))}
        onConfirm={(marketplaceIds) => {
          onProcess(Array.from(selectedIds), marketplaceIds);
        }}
      />
    </div>
  );
}
