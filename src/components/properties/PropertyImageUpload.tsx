import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useImageUpload } from '@/hooks/useImageUpload';
import { ImagePlus, X, Star, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertyImage {
  id?: string;
  url: string;
  publicId?: string;
  is_cover?: boolean;
  display_order?: number;
  phash?: string;
}

interface PropertyImageUploadProps {
  images: PropertyImage[];
  onChange: (images: PropertyImage[]) => void;
  maxImages?: number;
  organizationId?: string;
}

export function PropertyImageUpload({ images, onChange, maxImages = 200, organizationId }: PropertyImageUploadProps) {
  const { uploadMultipleImages, isUploading, uploadProgress } = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length === 0) return;

    const uploadedImages = await uploadMultipleImages(filesToUpload, 'properties', {
      organizationId,
    });

    if (uploadedImages.length > 0) {
      const newImages: PropertyImage[] = uploadedImages.map((img, index) => ({
        url: img.url,
        publicId: img.publicId,
        is_cover: images.length === 0 && index === 0,
        display_order: images.length + index,
        phash: img.phash,
      }));

      onChange([...images, ...newImages]);
    }

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    
    // Se removeu a capa, definir a primeira como capa
    if (images[index].is_cover && newImages.length > 0) {
      newImages[0].is_cover = true;
    }

    onChange(newImages);
  };

  const handleSetCover = (index: number) => {
    const newImages = images.map((img, i) => ({
      ...img,
      is_cover: i === index,
    }));
    onChange(newImages);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    // Atualizar display_order
    newImages.forEach((img, i) => {
      img.display_order = i;
    });

    onChange(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Fotos do Imóvel ({images.length}/{maxImages})
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || images.length >= maxImages}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-2" />
          )}
          Adicionar fotos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {isUploading && (
        <div className="space-y-2">
          <Progress value={uploadProgress} />
          <p className="text-xs text-muted-foreground text-center">
            Enviando imagens...
          </p>
        </div>
      )}

      {images.length === 0 ? (
        <Card
          className="border-dashed cursor-pointer hover:border-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ImagePlus className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Clique para adicionar fotos</p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG ou WEBP (máx. 10MB cada)
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image, index) => (
            <div
              key={image.publicId || image.url}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden group cursor-grab active:cursor-grabbing border",
                draggedIndex === index && "opacity-50",
                image.is_cover && "ring-2 ring-primary"
              )}
            >
              <img
                src={image.url}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay com ações */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleSetCover(index)}
                  title="Definir como capa"
                >
                  <Star className={cn("h-4 w-4", image.is_cover && "fill-yellow-500 text-yellow-500")} />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemoveImage(index)}
                  title="Remover"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Badge de capa */}
              {image.is_cover && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                  Capa
                </div>
              )}

              {/* Ícone de arrastar */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-4 w-4 text-white" />
              </div>
            </div>
          ))}

          {/* Botão de adicionar mais */}
          {images.length < maxImages && (
            <div
              className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Arraste para reordenar. Clique na estrela para definir a foto de capa.
      </p>
    </div>
  );
}
