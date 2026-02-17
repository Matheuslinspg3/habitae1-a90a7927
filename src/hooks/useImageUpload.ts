import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateImagePhash, hammingDistance, PHASH_DUPLICATE_THRESHOLD } from '@/lib/imagePhash';
import { normalizeImageBeforeUpload, computeFileHash } from '@/lib/imageNormalizer';

interface UploadedImage {
  url: string;
  publicId: string;
  storageProvider?: 'r2' | 'cloudinary';
  phash?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

interface CloudinarySignature {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
  overwrite: boolean;
  transformation: string;
  unique_filename: boolean;
  public_id?: string;
}

interface DuplicateMatch {
  url: string;
  phash: string;
  property_title?: string;
}

// ── R2 Upload ──

async function uploadToR2(file: File, folder: string): Promise<UploadedImage | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const { data, error } = await supabase.functions.invoke('r2-upload', {
    body: formData,
  });

  if (error || !data?.url) {
    console.warn('R2 upload failed, will try fallback:', error || data);
    return null;
  }

  return {
    url: data.url,
    publicId: data.key,
    storageProvider: 'r2',
  };
}

// ── Cloudinary Upload (with incoming transformation + hash dedupe) ──

async function getCloudinarySignature(folder: string, fileHash?: string): Promise<CloudinarySignature | null> {
  try {
    const { data, error } = await supabase.functions.invoke('cloudinary-sign', {
      body: { folder, file_hash: fileHash },
    });
    if (error) {
      console.error('Erro ao obter assinatura Cloudinary:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Erro ao chamar edge function Cloudinary:', error);
    return null;
  }
}

async function uploadToCloudinary(file: File, folder: string, fileHash?: string): Promise<UploadedImage | null> {
  const signature = await getCloudinarySignature(folder, fileHash);
  if (!signature) return null;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signature.api_key);
  formData.append('timestamp', signature.timestamp.toString());
  formData.append('signature', signature.signature);
  formData.append('folder', signature.folder);
  formData.append('overwrite', String(signature.overwrite));
  formData.append('transformation', signature.transformation);
  formData.append('unique_filename', String(signature.unique_filename));

  if (signature.public_id) {
    formData.append('public_id', signature.public_id);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Cloudinary upload error:', errorData);
    return null;
  }

  const result = await response.json();
  const reduction = file.size > 0 ? Math.round((1 - result.bytes / file.size) * 100) : 0;
  console.log(`[UPLOAD] Cloudinary OK: ${(result.bytes / 1024).toFixed(0)}KB stored (sent ${(file.size / 1024).toFixed(0)}KB, ${reduction}% saving)`);

  return {
    url: result.secure_url,
    publicId: result.public_id,
    storageProvider: 'cloudinary',
  };
}

// ── pHash Duplicate Detection ──

async function findDuplicateByPhash(
  phash: string,
  organizationId: string,
  _excludePropertyId?: string
): Promise<DuplicateMatch | null> {
  const { data: existingImages } = await supabase
    .from('property_images')
    .select(`url, phash, properties!inner(organization_id, title)`)
    .not('phash', 'is', null)
    .eq('properties.organization_id', organizationId);

  if (existingImages) {
    for (const img of existingImages) {
      if (img.phash && hammingDistance(phash, img.phash) <= PHASH_DUPLICATE_THRESHOLD) {
        const prop = img.properties as any;
        return { url: img.url, phash: img.phash, property_title: prop?.title };
      }
    }
  }

  const { data: mediaImages } = await supabase
    .from('property_media')
    .select('stored_url, original_url, phash')
    .eq('organization_id', organizationId)
    .not('phash', 'is', null);

  if (mediaImages) {
    for (const img of mediaImages) {
      if (img.phash && hammingDistance(phash, img.phash) <= PHASH_DUPLICATE_THRESHOLD) {
        return { url: img.stored_url || img.original_url, phash: img.phash };
      }
    }
  }

  return null;
}

// ── Main Hook ──

export function useImageUpload() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [duplicatesFound, setDuplicatesFound] = useState(0);

  const uploadImage = useCallback(async (
    file: File,
    folder: string = 'properties',
    options?: { organizationId?: string; skipDuplicateCheck?: boolean; excludePropertyId?: string }
  ): Promise<UploadedImage | null> => {
    const orgFolder = options?.organizationId ? `${folder}/${options.organizationId}` : folder;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Erro no upload', description: 'Apenas imagens são permitidas', variant: 'destructive' });
        return null;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Erro no upload', description: 'A imagem deve ter no máximo 10MB', variant: 'destructive' });
        return null;
      }

      setUploadProgress(5);

      // ─── Step 1: Normalize image (resize, strip EXIF, compress) ───
      const normalizedFile = await normalizeImageBeforeUpload(file, {
        maxDimension: 2048,
        quality: 0.82,
        outputFormat: 'image/webp',
      });
      setUploadProgress(15);

      // ─── Step 2: Generate pHash for visual dedupe ───
      let phash: string | undefined;
      try {
        phash = await generateImagePhash(normalizedFile);
      } catch (e) {
        console.warn('Falha ao gerar pHash:', e);
      }
      setUploadProgress(20);

      // ─── Step 3: Check pHash duplicates in DB ───
      if (phash && options?.organizationId && !options?.skipDuplicateCheck) {
        const duplicate = await findDuplicateByPhash(phash, options.organizationId, options.excludePropertyId);
        if (duplicate) {
          console.log(`[DEDUPE] pHash match → reutilizando: ${duplicate.url}`);
          setDuplicatesFound((prev) => prev + 1);
          toast({
            title: 'Imagem duplicada detectada',
            description: duplicate.property_title
              ? `Foto já existe no imóvel "${duplicate.property_title}". Reutilizando.`
              : 'Foto idêntica já existe. Reutilizando.',
          });
          return {
            url: duplicate.url,
            publicId: '',
            isDuplicate: true,
            duplicateOf: duplicate.url,
            phash,
          };
        }
      }
      setUploadProgress(30);

      // ─── Step 4: Compute SHA-256 hash for Cloudinary dedupe ───
      const fileHash = await computeFileHash(normalizedFile);
      setUploadProgress(35);

      // ─── Step 5: Upload (R2 primary, Cloudinary fallback) ───
      console.log(`[UPLOAD] Tentando R2 (${(normalizedFile.size / 1024).toFixed(0)}KB, pasta: ${orgFolder})...`);
      let result = await uploadToR2(normalizedFile, orgFolder);

      if (!result) {
        console.log('[UPLOAD] R2 falhou. Tentando Cloudinary com normalização incoming...');
        setUploadProgress(50);
        result = await uploadToCloudinary(normalizedFile, orgFolder, fileHash);
      }

      if (!result) {
        toast({ title: 'Erro no upload', description: 'Não foi possível enviar a imagem para nenhum storage', variant: 'destructive' });
        return null;
      }

      setUploadProgress(100);
      console.log(`[UPLOAD] Concluído via ${result.storageProvider}: ${result.url}`);
      return { ...result, phash };
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({ title: 'Erro no upload', description: error.message || 'Não foi possível enviar a imagem', variant: 'destructive' });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [toast]);

  const uploadMultipleImages = useCallback(async (
    files: File[],
    folder: string = 'properties',
    options?: { organizationId?: string; skipDuplicateCheck?: boolean; excludePropertyId?: string }
  ): Promise<UploadedImage[]> => {
    setDuplicatesFound(0);
    const results: UploadedImage[] = [];
    for (const file of files) {
      const result = await uploadImage(file, folder, options);
      if (result) results.push(result);
    }
    if (duplicatesFound > 0) {
      toast({
        title: `${duplicatesFound} duplicata(s) reutilizada(s)`,
        description: 'Imagens idênticas foram reutilizadas, economizando espaço.',
      });
    }
    return results;
  }, [uploadImage, duplicatesFound, toast]);

  const deleteImage = useCallback(async (publicId: string): Promise<boolean> => {
    console.log('Imagem marcada para remoção:', publicId);
    return true;
  }, []);

  return {
    uploadImage,
    uploadMultipleImages,
    deleteImage,
    isUploading,
    uploadProgress,
    duplicatesFound,
  };
}
