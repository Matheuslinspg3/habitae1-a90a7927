import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MapPin, Bed, Bath, Car, Ruler, MoreHorizontal, Edit, Trash2, Building2, Eye, ExternalLink, Hash, Store, ImageIcon, FileText, Import } from "lucide-react";
import { PropertyFreshnessBadge } from "./PropertyFreshnessBadge";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { PropertyStatusBadge, transactionLabels } from "./PropertyStatusBadge";
import type { PropertyWithDetails } from "@/hooks/useProperties";
import { proxyDriveImageUrl } from "@/lib/utils";
import { getImageUrl, getImageSrcSet, type ImageRecord } from "@/lib/imageUrl";
import { usePropertyPublicUrl } from "@/hooks/usePropertyPublicUrl";

interface PropertyCardProps {
  property: PropertyWithDetails;
  onEdit: (property: PropertyWithDetails) => void;
  onDelete: (id: string) => void;
  isPublished?: boolean;
}

// PERF: memo prevents re-render when parent re-renders but props haven't changed
export const PropertyCard = memo(function PropertyCard({ property, onEdit, onDelete, isPublished }: PropertyCardProps) {
  const navigate = useNavigate();
  const { buildPublicUrl } = usePropertyPublicUrl();
  const isAvailable = property.status === "disponivel";
  const coverImageData = property.images?.find((img) => img.is_cover) || property.images?.[0] || null;
  
  // Use optimized image URL helper for R2/Cloudinary
  const getCoverImage = () => {
    if (!isAvailable || !coverImageData) return null;
    const imageRecord = coverImageData as unknown as ImageRecord;
    // Use unified getImageUrl for all providers (R2, Cloudinary proxy, etc.)
    if (imageRecord.storage_provider === 'r2' || imageRecord.r2_key_thumb) {
      return getImageUrl(imageRecord, 'thumb');
    }
    // Drive file ID proxy
    const driveFileId = (coverImageData as any).drive_file_id;
    if (driveFileId) {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      return `${baseUrl}/functions/v1/drive-image-proxy?id=${driveFileId}&sz=w800`;
    }
    // For Cloudinary/legacy: use getImageUrl which applies proxy
    return getImageUrl(imageRecord, 'thumb');
  };
  const coverImage = getCoverImage();
  const coverSrcSet = coverImageData ? getImageSrcSet(coverImageData as unknown as ImageRecord) : undefined;
  const imageCount = isAvailable ? (property.images?.length || 0) : 0;

  const formatPrice = (price: number | null, isRent: boolean = false) => {
    if (!price) return null;
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(price);
    return isRent ? `${formatted}/mês` : formatted;
  };

  const getDisplayPrice = () => {
    if (property.transaction_type === "aluguel") {
      return formatPrice(property.rent_price, true);
    }
    if (property.transaction_type === "venda") {
      return formatPrice(property.sale_price);
    }
    return property.sale_price 
      ? formatPrice(property.sale_price)
      : formatPrice(property.rent_price, true);
  };

  const getFullAddress = () => {
    const parts = [
      property.address_street,
      property.address_number,
      property.address_neighborhood,
      property.address_city,
    ].filter(Boolean);
    return parts.join(", ") || "Endereço não informado";
  };

  const handleViewDetails = () => {
    navigate(`/imoveis/${property.id}`);
  };

  const handleOpenLandingPage = () => {
    window.open(buildPublicUrl(property.id, property.property_code), "_blank");
  };

  // Compact card for unavailable properties
  if (!isAvailable) {
    return (
      <Card className="overflow-hidden border-border/40 opacity-75 touch-manipulation">
        <div className="flex items-center gap-3 p-3">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate text-sm">{property.title || "Sem título"}</h3>
              <PropertyStatusBadge status={property.status} className="text-xs" />
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {(property as any).property_code ? `#${(property as any).property_code} · ` : ""}
              {property.address_city || "Sem localização"}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleViewDetails}>
                <Eye className="h-4 w-4 mr-2" /> Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(property)}>
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(property.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden card-hover-lift group touch-manipulation border-border/60">
      {/* Image Section */}
      <div className="relative aspect-video bg-muted cursor-pointer overflow-hidden" onClick={handleViewDetails}>
        {coverImage ? (
          <>
            <img
              src={coverImage}
              srcSet={coverSrcSet}
              sizes={coverSrcSet ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px" : undefined}
              alt={property.title || "Imóvel"}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                console.error('[PropertyCard] Image load error:', e.currentTarget.src);
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-full h-full absolute inset-0 items-center justify-center bg-muted hidden">
              <Building2 className="h-12 w-12 text-muted-foreground/40" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-foreground/40 to-transparent pointer-events-none" />

        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {isPublished && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-accent text-accent-foreground rounded-full p-1.5 shadow-md">
                  <Store className="h-3.5 w-3.5" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Publicado no Marketplace</TooltipContent>
            </Tooltip>
          )}
          <PropertyStatusBadge status={property.status} />
          {(property as any).availability_status && (property as any).availability_status !== 'available' && (
            <AvailabilityBadge status={(property as any).availability_status} />
          )}
        </div>

        {imageCount > 1 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-foreground/60 text-background rounded-md px-2 py-0.5 text-xs font-medium">
            <ImageIcon className="h-3 w-3" />
            {imageCount}
          </div>
        )}

        <div className="absolute bottom-2 right-2">
          <span className="text-sm font-bold text-background drop-shadow-md">
            {getDisplayPrice() || "Sob consulta"}
          </span>
        </div>
      </div>

      <CardHeader className="pb-2 pt-3">
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate text-sm">{property.title || "Sem título"}</h3>
              <PropertyFreshnessBadge updatedAt={property.updated_at} compact />
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{getFullAddress()}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleViewDetails}>
                <Eye className="h-4 w-4 mr-2" /> Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenLandingPage}>
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir landing page
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(property)}>
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(property.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(property as any).property_code && (
            <Badge variant="outline" className="font-mono text-xs">
              <Hash className="h-3 w-3 mr-0.5" />
              {(property as any).property_code}
            </Badge>
          )}
          {(property as any).source_provider === 'imobzi' && (
            <Badge variant="secondary" className="text-xs bg-info/15 text-info">
              <Import className="w-3 h-3 mr-0.5" /> Imobzi
            </Badge>
          )}
          {(property as any).source_provider === 'pdf' && (
            <>
              <Badge variant="secondary" className="text-xs bg-info/15 text-info">
                <FileText className="w-3 h-3 mr-0.5" /> PDF
              </Badge>
              {(property as any).source_code && (
                <Badge variant="outline" className="text-xs max-w-[120px] truncate">
                  {(property as any).source_code}
                </Badge>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {(property.bedrooms ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <Bed className="h-3.5 w-3.5" />
              <span>{property.bedrooms}</span>
            </div>
          )}
          {(property.suites ?? 0) > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-primary">
                  <Bed className="h-3.5 w-3.5" />
                  <span>{property.suites}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Suíte(s)</TooltipContent>
            </Tooltip>
          )}
          {(property.bathrooms ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" />
              <span>{property.bathrooms}</span>
            </div>
          )}
          {(property.parking_spots ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <Car className="h-3.5 w-3.5" />
              <span>{property.parking_spots}</span>
            </div>
          )}
          {property.area_total && (
            <div className="flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" />
              <span>{property.area_total}m²</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t border-border/50">
        <div className="flex items-center justify-between w-full">
          {property.property_type && (
            <Badge variant="secondary" className="text-xs">
              {property.property_type.name}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs ml-auto">
            {transactionLabels[property.transaction_type] || property.transaction_type}
          </Badge>
        </div>
      </CardFooter>
    </Card>
  );
});
