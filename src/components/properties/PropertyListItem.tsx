import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, Bed, Bath, Car, Ruler, MoreHorizontal, Edit, Trash2, Eye, ExternalLink, Hash, Building2, Store, CopyPlus } from "lucide-react";
import { PropertyFreshnessBadge } from "./PropertyFreshnessBadge";
import { PropertyStatusBadge, transactionLabels } from "./PropertyStatusBadge";
import { AvailabilityBadge } from "./AvailabilityBadge";
import type { PropertyWithDetails } from "@/hooks/useProperties";
import { cn, proxyDriveImageUrl } from "@/lib/utils";
import { getImageUrl, type ImageRecord } from "@/lib/imageUrl";
import { usePropertyPublicUrl } from "@/hooks/usePropertyPublicUrl";

interface PropertyListItemProps {
  property: PropertyWithDetails;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (property: PropertyWithDetails) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  isPublished?: boolean;
}

// PERF: memo prevents re-render when sibling list items change
export const PropertyListItem = memo(function PropertyListItem({
  property,
  isSelected,
  isSelectionMode,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  isPublished,
}: PropertyListItemProps) {
  const navigate = useNavigate();
  const { buildPublicUrl } = usePropertyPublicUrl();
  const coverImageData = property.images?.find((img) => img.is_cover) || property.images?.[0] || null;
  const imageRecord = coverImageData as unknown as ImageRecord | null;
  const coverImage = (() => {
    if (!imageRecord) return null;
    if (imageRecord.storage_provider === 'r2' || imageRecord.r2_key_thumb) {
      return getImageUrl(imageRecord, 'thumb');
    }
    if (imageRecord.cached_thumbnail_url) {
      return imageRecord.cached_thumbnail_url;
    }
    return coverImageData?.url ? proxyDriveImageUrl(coverImageData.url) : null;
  })();

  const formatPrice = (price: number | null, isRent = false) => {
    if (!price) return null;
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(price);
    return isRent ? `${formatted}/mês` : formatted;
  };

  const getDisplayPrice = () => {
    if (property.transaction_type === "aluguel") return formatPrice(property.rent_price, true);
    if (property.transaction_type === "venda") return formatPrice(property.sale_price);
    return property.sale_price ? formatPrice(property.sale_price) : formatPrice(property.rent_price, true);
  };

  const getAddress = () => {
    const parts = [property.address_neighborhood, property.address_city].filter(Boolean);
    return parts.join(", ") || "Endereço não informado";
  };

  const isAvailable = property.status === "disponivel";

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 border border-border/60 rounded-lg hover:bg-accent/10 transition-colors cursor-pointer",
        isSelected && "ring-2 ring-primary bg-primary/5",
        !isAvailable && "opacity-70"
      )}
      onClick={() => navigate(`/imoveis/${property.id}`)}
    >
      {/* Top row: checkbox + image + info */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        {/* Checkbox */}
        <div
          className={cn("transition-opacity shrink-0 mt-1 sm:mt-0", isSelectionMode ? "opacity-100" : "opacity-0 hover:opacity-100")}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(property.id, checked as boolean)}
            className="h-5 w-5"
          />
        </div>

        {/* Thumbnail */}
        {isAvailable && (
          <div className="w-14 h-14 sm:w-20 sm:h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
            {coverImage ? (
              <img src={coverImage} alt={property.title || "Imóvel"} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-medium truncate text-sm">{property.title || "Sem título"}</h4>
            {(property as any).property_code && (
              <Badge variant="outline" className="font-mono text-[10px] px-1 shrink-0 hidden sm:inline-flex">
                <Hash className="h-2.5 w-2.5 mr-0.5" />
                {(property as any).property_code}
              </Badge>
            )}
            {isAvailable && <PropertyFreshnessBadge updatedAt={property.updated_at} compact />}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{getAddress()}</span>
          </div>
          {/* Mobile: show price + status inline */}
          <div className="flex items-center gap-1.5 mt-1 sm:hidden flex-wrap">
            {isAvailable && getDisplayPrice() && (
              <span className="font-semibold text-xs text-primary">{getDisplayPrice()}</span>
            )}
            <PropertyStatusBadge status={property.status} className="text-[10px]" />
            {(property as any).availability_status && (property as any).availability_status !== 'available' && (
              <AvailabilityBadge status={(property as any).availability_status} />
            )}
            {isAvailable && (
              <Badge variant="outline" className="text-[10px] px-1">
                {transactionLabels[property.transaction_type] || property.transaction_type}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Features - desktop only */}
      {isAvailable && (
        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
          {(property.bedrooms ?? 0) > 0 && (
            <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{property.bedrooms}</span>
          )}
          {(property.suites ?? 0) > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-primary"><Bed className="h-3 w-3" />{property.suites}</span>
              </TooltipTrigger>
              <TooltipContent>Suíte(s)</TooltipContent>
            </Tooltip>
          )}
          {(property.bathrooms ?? 0) > 0 && (
            <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{property.bathrooms}</span>
          )}
          {(property.parking_spots ?? 0) > 0 && (
            <span className="flex items-center gap-1"><Car className="h-3 w-3" />{property.parking_spots}</span>
          )}
          {property.area_total && (
            <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{property.area_total}m²</span>
          )}
        </div>
      )}

      {/* Status & Price - desktop */}
      <div className="hidden sm:flex flex-col items-end gap-1">
        {isAvailable && (
          <span className="font-semibold text-sm text-primary">{getDisplayPrice() || "Sob consulta"}</span>
        )}
        <div className="flex items-center gap-1">
          {isPublished && isAvailable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-accent text-accent-foreground rounded-full p-1 shadow-sm">
                  <Store className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Publicado no Marketplace</TooltipContent>
            </Tooltip>
          )}
          <PropertyStatusBadge status={property.status} className="text-xs" />
          {isAvailable && (
            <Badge variant="outline" className="text-xs">
              {transactionLabels[property.transaction_type] || property.transaction_type}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div onClick={(e) => e.stopPropagation()} className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/imoveis/${property.id}`)}>
              <Eye className="h-4 w-4 mr-2" /> Ver detalhes
            </DropdownMenuItem>
            {isAvailable && (
              <DropdownMenuItem onClick={() => window.open(buildPublicUrl(property.id, property.property_code), "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir landing page
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(property)}>
              <Edit className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            {onDuplicate && (
              <DropdownMenuItem onClick={() => onDuplicate(property.id)}>
                <CopyPlus className="h-4 w-4 mr-2" /> Duplicar Imóvel
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(property.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
