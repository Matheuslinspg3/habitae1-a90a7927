import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageViewerProps {
  images: Array<{
    url: string;
    alt?: string;
    hotspots?: Array<{
      x: number;
      y: number;
      label: string;
      description?: string;
    }>;
  }>;
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewer({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredHotspot, setHoveredHotspot] = useState<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      // Prevent body scroll when viewer is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, initialIndex]);

  const currentImage = images[currentIndex];

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) setPosition({ x: 0, y: 0 });
      return newZoom;
    });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    handleReset();
  }, [images.length, handleReset]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    handleReset();
  }, [images.length, handleReset]);

  // Mouse drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [zoom, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && zoom > 1) {
        setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      }
    },
    [isDragging, dragStart, zoom]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else handleZoomOut();
    },
    [handleZoomIn, handleZoomOut]
  );

  // Touch swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || zoom > 1) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;

      if (Math.abs(dx) > 50 && Math.abs(dy) < 100 && dt < 400) {
        if (dx > 0) handlePrevious();
        else handleNext();
      }
      touchStartRef.current = null;
    },
    [zoom, handlePrevious, handleNext]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft": handlePrevious(); break;
        case "ArrowRight": handleNext(); break;
        case "+": case "=": handleZoomIn(); break;
        case "-": handleZoomOut(); break;
        case "r": handleRotate(); break;
        case "Escape": onOpenChange(false); break;
      }
    },
    [handlePrevious, handleNext, handleZoomIn, handleZoomOut, handleRotate, onOpenChange]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      ref={(el) => el?.focus()}
    >
      {/* Compact header */}
      <div className="flex items-center justify-between px-2 py-1.5 md:px-4 md:py-2 border-b bg-background/80 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-1 md:gap-2">
          <Badge variant="secondary" className="text-xs">
            {currentIndex + 1} / {images.length}
          </Badge>
          <Badge variant="outline" className="text-xs hidden sm:inline-flex">
            {Math.round(zoom * 100)}%
          </Badge>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} disabled={zoom <= 1}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} disabled={zoom >= 4}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:inline-flex" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
          {(zoom !== 1 || rotation !== 0) && (
            <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:inline-flex" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image stage - takes all remaining space */}
      <div
        ref={containerRef}
        className={cn(
          "flex-1 relative overflow-hidden select-none min-h-0",
          zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: zoom > 1 ? "none" : "pan-y" }}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.2s ease",
          }}
        >
          <img
            src={currentImage?.url}
            alt={currentImage?.alt || `Imagem ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain select-none p-1"
            draggable={false}
          />

          {/* Hotspots */}
          {currentImage?.hotspots?.map((hotspot, index) => (
            <div
              key={index}
              className="absolute cursor-pointer"
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              onMouseEnter={() => setHoveredHotspot(index)}
              onMouseLeave={() => setHoveredHotspot(null)}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full bg-primary/80 border-2 border-primary-foreground flex items-center justify-center text-xs font-bold text-primary-foreground transition-transform",
                  hoveredHotspot === index && "scale-125"
                )}
              >
                {index + 1}
              </div>
              {hoveredHotspot === index && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 z-10 min-w-[200px]">
                  <div className="bg-popover text-popover-foreground border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-sm">{hotspot.label}</p>
                    {hotspot.description && (
                      <p className="text-xs text-muted-foreground mt-1">{hotspot.description}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 h-8 w-8 md:h-10 md:w-10 hidden sm:flex"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 h-8 w-8 md:h-10 md:w-10 hidden sm:flex"
              onClick={handleNext}
            >
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
            </Button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-1.5 md:gap-2 px-2 py-1.5 md:px-4 md:py-2 border-t bg-background/80 backdrop-blur-sm overflow-x-auto scrollbar-hide shrink-0">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                handleReset();
              }}
              className={cn(
                "w-10 h-10 md:w-14 md:h-14 rounded-md overflow-hidden border-2 flex-shrink-0 transition-all",
                index === currentIndex
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img src={image.url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Desktop hint */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 px-3 py-1 rounded-full hidden md:block pointer-events-none">
        Roda do mouse para zoom • Arraste para mover • R para rotacionar
      </div>

      {/* Mobile swipe hint */}
      {images.length > 1 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 px-3 py-1 rounded-full md:hidden pointer-events-none">
          Deslize para navegar
        </div>
      )}
    </div>
  );
}

// ─── ImageGallery ────────────────────────────────────────────

interface ImageGalleryProps {
  images: Array<{
    url: string;
    alt?: string;
    is_cover?: boolean;
  }>;
  onViewDetails?: () => void;
}

export function ImageGallery({ images, onViewDetails }: ImageGalleryProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <p className="text-muted-foreground">Nenhuma imagem disponível</p>
      </div>
    );
  }

  // Normalize: cover first, then the rest in original order
  const coverIndex = images.findIndex((img) => img.is_cover);
  const orderedImages =
    coverIndex > 0
      ? [images[coverIndex], ...images.filter((_, i) => i !== coverIndex)]
      : [...images];

  const coverImage = orderedImages[0];
  const sideImages = orderedImages.slice(1, 4);
  const remainingCount = Math.max(0, orderedImages.length - 3);

  const handleImageClick = (orderedIndex: number) => {
    setSelectedIndex(orderedIndex);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="rounded-xl overflow-hidden">
        {/* Single image */}
        {orderedImages.length === 1 && (
          <div
            className="relative aspect-[4/3] md:aspect-[16/9] lg:aspect-[21/9] cursor-pointer group"
            onClick={() => handleImageClick(0)}
          >
            <img src={coverImage.url} alt={coverImage.alt || "Imagem principal"} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
              <ZoomIn className="h-8 w-8 text-background opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </div>
        )}

        {/* Two images */}
        {orderedImages.length === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {orderedImages.map((image, index) => (
              <div key={index} className="relative aspect-[4/3] cursor-pointer group" onClick={() => handleImageClick(index)}>
                <img src={image.url} alt={image.alt || `Imagem ${index + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
              </div>
            ))}
          </div>
        )}

        {/* Three+ images */}
        {orderedImages.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-1">
            {/* Cover */}
            <div className="relative aspect-[4/3] cursor-pointer group" onClick={() => handleImageClick(0)}>
              <img src={coverImage.url} alt={coverImage.alt || "Imagem principal"} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-background opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>

            {/* Desktop side thumbnails */}
            <div className="hidden md:grid grid-rows-2 gap-1">
              {sideImages.slice(0, 2).map((image, index) => (
                <div key={index} className="relative cursor-pointer group overflow-hidden" onClick={() => handleImageClick(index + 1)}>
                  <img src={image.url} alt={image.alt || `Imagem ${index + 2}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
                  {index === 1 && remainingCount > 0 && (
                    <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                      <span className="text-2xl font-bold text-background drop-shadow-lg">+{remainingCount}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile horizontal thumbnails */}
            <div className="flex md:hidden gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
              {orderedImages.slice(1, 6).map((image, index) => (
                <div
                  key={index}
                  className="relative flex-shrink-0 w-24 h-24 cursor-pointer group rounded-lg overflow-hidden"
                  onClick={() => handleImageClick(index + 1)}
                >
                  <img src={image.url} alt={image.alt || `Imagem ${index + 2}`} className="w-full h-full object-cover" />
                  {index === 4 && orderedImages.length > 6 && (
                    <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                      <span className="text-sm font-bold text-background">+{orderedImages.length - 6}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ImageViewer
        images={orderedImages.map((img) => ({ url: img.url, alt: img.alt }))}
        initialIndex={selectedIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}
