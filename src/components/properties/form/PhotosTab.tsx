import { UseFormReturn } from "react-hook-form";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PropertyImageUpload } from "../PropertyImageUpload";
import { Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PropertyImage {
  id?: string;
  url: string;
  path?: string;
  is_cover?: boolean;
  display_order?: number;
  phash?: string;
}

interface PhotosTabProps {
  form: UseFormReturn<any>;
  images: PropertyImage[];
  onImagesChange: (images: PropertyImage[]) => void;
}

export function PhotosTab({ form, images, onImagesChange }: PhotosTabProps) {
  const { profile } = useAuth();

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Adicione fotos do imóvel (opcional). A primeira foto será usada como capa.
      </p>
      <PropertyImageUpload
        images={images}
        onChange={onImagesChange}
        maxImages={50}
        organizationId={profile?.organization_id}
      />

      <div className="border-t pt-4">
        <FormField control={form.control} name="youtube_url" render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Vídeo do YouTube
            </FormLabel>
            <FormControl>
              <Input placeholder="https://www.youtube.com/watch?v=..." {...field} value={field.value || ""} />
            </FormControl>
            <p className="text-xs text-muted-foreground">Cole a URL do vídeo do YouTube do imóvel (opcional)</p>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </div>
  );
}
