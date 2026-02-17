import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
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
  const containerRef = useRef<HTMLDivElement>(null);

  const currentImage = images[currentIndex];

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
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
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    },
    [handleZoomIn, handleZoomOut]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "r":
          handleRotate();
          break;
        case "Escape":
          onOpenChange(false);
          break;
      }
    },
    [handlePrevious, handleNext, handleZoomIn, handleZoomOut, handleRotate, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-background/95 backdrop-blur-sm"
        onKeyDown={handleKeyDown}
      >
        <div className="relative w-full h-full flex flex-col">
          {/* Header with controls */}
          <div className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {currentIndex + 1} / {images.length}
              </Badge>
              <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 1}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 4}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleRotate}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleReset}>
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main image area */}
          <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform duration-200"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              <img
                src={currentImage?.url}
                alt={currentImage?.alt || `Imagem ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain select-none"
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {hotspot.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 p-4 border-t bg-background/80 backdrop-blur-sm overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    handleReset();
                  }}
                  className={cn(
                    "w-16 h-16 rounded-md overflow-hidden border-2 flex-shrink-0 transition-all",
                    index === currentIndex
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Zoom hint */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 px-3 py-1 rounded-full">
            Use a roda do mouse ou +/- para zoom • Arraste para mover • R para
            rotacionar
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

  const coverImage = images.find((img) => img.is_cover) || images[0];
  const sideImages = images.filter((img) => img !== coverImage).slice(0, 3);
  const remainingCount = images.length - 1 - sideImages.length;

  const handleImageClick = (index: number) => {
    setSelectedIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="rounded-xl overflow-hidden">
        {/* Single image layout */}
        {images.length === 1 && (
          <div
            className="relative aspect-[16/9] md:aspect-[21/9] cursor-pointer group"
            onClick={() => handleImageClick(0)}
          >
            <img
              src={coverImage.url}
              alt={coverImage.alt || "Imagem principal"}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
              <ZoomIn className="h-8 w-8 text-background opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </div>
        )}

        {/* Two images layout */}
        {images.length === 2 && (
          <div className="grid grid-cols-2 gap-1">
            {images.slice(0, 2).map((image, index) => (
              <div
                key={index}
                className="relative aspect-[4/3] cursor-pointer group"
                onClick={() => handleImageClick(index)}
              >
                <img
                  src={image.url}
                  alt={image.alt || `Imagem ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
              </div>
            ))}
          </div>
        )}

        {/* Three+ images: main + side grid */}
        {images.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-1 max-h-[480px]">
            {/* Cover image */}
            <div
              className="relative aspect-[4/3] md:aspect-auto cursor-pointer group"
              onClick={() => handleImageClick(0)}
            >
              <img
                src={coverImage.url}
                alt={coverImage.alt || "Imagem principal"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-background opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>

            {/* Side thumbnails */}
            <div className="hidden md:grid grid-rows-2 gap-1">
              {sideImages.slice(0, 2).map((image, index) => (
                <div
                  key={index}
                  className="relative cursor-pointer group overflow-hidden"
                  onClick={() => handleImageClick(index + 1)}
                >
                  <img
                    src={image.url}
                    alt={image.alt || `Imagem ${index + 2}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
                  {/* Show remaining count on last visible thumbnail */}
                  {index === 1 && remainingCount > 0 && (
                    <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                      <span className="text-2xl font-bold text-background drop-shadow-lg">
                        +{remainingCount}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: horizontal scroll thumbnails */}
            <div className="flex md:hidden gap-1 overflow-x-auto pb-1">
              {images.slice(1, 5).map((image, index) => (
                <div
                  key={index}
                  className="relative flex-shrink-0 w-24 h-24 cursor-pointer group rounded-md overflow-hidden"
                  onClick={() => handleImageClick(index + 1)}
                >
                  <img
                    src={image.url}
                    alt={image.alt || `Imagem ${index + 2}`}
                    className="w-full h-full object-cover"
                  />
                  {index === 3 && remainingCount > 0 && (
                    <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                      <span className="text-sm font-bold text-background">+{remainingCount}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ImageViewer
        images={images.map((img) => ({ url: img.url, alt: img.alt }))}
        initialIndex={selectedIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}
