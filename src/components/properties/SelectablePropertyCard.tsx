import { useRef, useCallback, memo } from "react";
import { PropertyWithDetails } from "@/hooks/useProperties";
import { PropertyCard } from "./PropertyCard";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface SelectablePropertyCardProps {
  property: PropertyWithDetails;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (property: PropertyWithDetails) => void;
  onDelete: (id: string) => void;
  isPublished?: boolean;
  onLongPressSelect?: (id: string) => void;
}

// PERF: memo prevents re-render of unaffected cards in selection mode
export const SelectablePropertyCard = memo(function SelectablePropertyCard({
  property,
  isSelected,
  isSelectionMode,
  onSelect,
  onEdit,
  onDelete,
  isPublished,
  onLongPressSelect,
}: SelectablePropertyCardProps) {
  const isMobile = useIsMobile();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handleTouchStart = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(30);
      if (onLongPressSelect) {
        onLongPressSelect(property.id);
      } else {
        onSelect(property.id, !isSelected);
      }
    }, 500);
  }, [property.id, isSelected, onSelect, onLongPressSelect]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // On mobile in selection mode, tap to toggle selection
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isMobile && isSelectionMode && !didLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(property.id, !isSelected);
    }
  }, [isMobile, isSelectionMode, property.id, isSelected, onSelect]);

  return (
    <div
      className={cn(
        "relative group transition-all",
        isSelected && "ring-2 ring-primary rounded-lg scale-[0.98]",
        isMobile && isSelectionMode && "active:scale-95"
      )}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onClickCapture={handleCardClick}
    >
      {/* Checkbox overlay */}
      <div 
        className={cn(
          "absolute top-3 left-3 z-10 transition-all duration-200",
          isSelectionMode
            ? "opacity-100 scale-100"
            : isMobile
              ? "opacity-0 pointer-events-none"
              : "opacity-0 group-hover:opacity-100"
        )}
      >
        <div 
          className={cn(
            "bg-background/90 backdrop-blur-sm rounded-md p-1.5 shadow-md cursor-pointer",
            isSelected && "bg-primary/20"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(property.id, !isSelected);
          }}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(property.id, checked as boolean)}
            className="h-5 w-5"
          />
        </div>
      </div>

      {/* Selection overlay on mobile */}
      {isMobile && isSelectionMode && (
        <div className={cn(
          "absolute inset-0 z-[5] rounded-lg pointer-events-none transition-colors",
          isSelected ? "bg-primary/10" : "bg-transparent"
        )} />
      )}
      
      <PropertyCard
        property={property}
        onEdit={onEdit}
        onDelete={onDelete}
        isPublished={isPublished}
      />
    </div>
  );
}
