import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateImagePhash, hammingDistance, PHASH_DUPLICATE_THRESHOLD } from '@/lib/imagePhash';
import { generateImageVariants } from '@/lib/imageVariants';

interface UploadedImage {
  url: string;
  publicId: string;
  storageProvider?: 'r2' | 'cloudinary';
  r2KeyFull?: string;
  r2KeyThumb?: string;
  publicUrlThumb?: string;
  phash?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

interface DuplicateMatch {
  url: string;
  phash: string;
  property_title?: string;
}

// ── Presigned R2 Upload ──

interface PresignResult {
  uploadId: string;
  r2KeyFull: string;
  r2KeyThumb: string;
  presignedPutUrlFull: string;
  presignedPutUrlThumb: string;
  publicUrlFull: string;
  publicUrlThumb: string;
  requiredHeaders: Record<string, string>;
}

async function getPresignedUrls(
  propertyId: string,
  files: Array<{ mimeType: string; sizeBytes: number }>,
): Promise<PresignResult[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke('r2-presign', {
      body: { propertyId, files },
    });

    if (error || !data?.uploads) {
      console.warn('Presign failed:', error || data);
      return null;
    }

    return data.uploads;
  } catch (e) {
    console.warn('Presign request failed:', e);
    return null;
  }
}

async function uploadBlobToPresignedUrl(
  blob: Blob,
  presignedUrl: string,
  headers: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'image/webp',
      },
      body: blob,
    });

    if (!res.ok) {
      console.error(`PUT failed (${res.status}):`, await res.text().catch(() => ''));
      return false;
    }

    return true;
  } catch (e) {
    console.error('PUT to presigned URL failed:', e);
    return false;
  }
}

async function uploadToR2Proxy(
  file: File,
  propertyId: string,
): Promise<UploadedImage | null> {
  // 1. Generate thumb + full variants client-side
  let variants;
  try {
    variants = await generateImageVariants(file);
  } catch (e) {
    console.error('Variant generation failed:', e);
    return null;
  }

  // 2. Build FormData with both variants
  const fd = new FormData();
  fd.append('full', new File([variants.full.blob], 'full.webp', { type: 'image/webp' }));
  fd.append('thumb', new File([variants.thumb.blob], 'thumb.webp', { type: 'image/webp' }));
  fd.append('propertyId', propertyId);

  // 3. Upload via edge function (server-side proxy to R2)
  try {
    const { data, error } = await supabase.functions.invoke('r2-upload', {
      body: fd,
    });

    if (error || !data?.r2KeyFull) {
      console.error('R2 proxy upload failed:', error || data);
      return null;
    }

    const fullKB = (variants.full.blob.size / 1024).toFixed(0);
    const thumbKB = (variants.thumb.blob.size / 1024).toFixed(0);
    if (import.meta.env.DEV) console.log(`[R2] Proxy upload OK: full=${fullKB}KB, thumb=${thumbKB}KB, key=${data.r2KeyFull}`);

    return {
      url: data.publicUrlFull,
      publicId: data.r2KeyFull,
      storageProvider: 'r2',
      r2KeyFull: data.r2KeyFull,
      r2KeyThumb: data.r2KeyThumb,
      publicUrlThumb: data.publicUrlThumb,
    };
  } catch (e) {
    console.error('R2 proxy request failed:', e);
    return null;
  }
}

// ── Cloudinary Fallback ──

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
  // Import normalizer only for Cloudinary path (legacy)
  const { normalizeImageBeforeUpload, computeFileHash: computeHash } = await import('@/lib/imageNormalizer');
  const normalizedFile = await normalizeImageBeforeUpload(file);
  const hash = fileHash || await computeHash(normalizedFile);

  const signature = await getCloudinarySignature(folder, hash);
  if (!signature) return null;

  const formData = new FormData();
  formData.append('file', normalizedFile);
  formData.append('api_key', signature.api_key);
  formData.append('timestamp', signature.timestamp.toString());
  formData.append('signature', signature.signature);
  formData.append('folder', signature.folder);
  formData.append('overwrite', String(signature.overwrite));
  formData.append('transformation', signature.transformation);
  formData.append('unique_filename', String(signature.unique_filename));
  if (signature.public_id) formData.append('public_id', signature.public_id);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`,
    { method: 'POST', body: formData },
  );

  if (!response.ok) {
    let errorMsg = `Status ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData?.error?.message || JSON.stringify(errorData);
      console.error('Cloudinary upload error:', errorData);
    } catch {
      console.error('Cloudinary upload error: status', response.status);
    }
    console.error(`[UPLOAD] Cloudinary failed: ${errorMsg}`);
    return null;
  }

  const result = await response.json();
  if (import.meta.env.DEV) console.log(`[UPLOAD] Cloudinary OK: ${(result.bytes / 1024).toFixed(0)}KB stored`);

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
  _excludePropertyId?: string,
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
    options?: {
      organizationId?: string;
      skipDuplicateCheck?: boolean;
      excludePropertyId?: string;
      propertyId?: string;
    },
  ): Promise<UploadedImage | null> => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Erro no upload', description: 'Apenas imagens são permitidas', variant: 'destructive' });
        return null;
      }
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        toast({ title: 'Erro no upload', description: 'SVG e GIF não são permitidos', variant: 'destructive' });
        return null;
      }
      if (file.size > 25 * 1024 * 1024) {
        toast({ title: 'Erro no upload', description: 'A imagem deve ter no máximo 25MB', variant: 'destructive' });
        return null;
      }

      setUploadProgress(5);

      // ─── Step 1: Generate pHash for visual dedupe ───
      let phash: string | undefined;
      try {
        phash = await generateImagePhash(file);
      } catch (e) {
        console.warn('Falha ao gerar pHash:', e);
      }
      setUploadProgress(15);

      // ─── Step 2: Check pHash duplicates in DB ───
      if (phash && options?.organizationId && !options?.skipDuplicateCheck) {
        const duplicate = await findDuplicateByPhash(phash, options.organizationId, options.excludePropertyId);
        if (duplicate) {
          if (import.meta.env.DEV) console.log(`[DEDUPE] pHash match → reutilizando: ${duplicate.url}`);
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
      setUploadProgress(25);

      // ─── Step 3: Upload (R2 presigned primary, Cloudinary fallback) ───
      let result: UploadedImage | null = null;

      // Always try R2 first — use a temp UUID if propertyId is not yet available
      const effectivePropertyId = options?.propertyId || crypto.randomUUID();
      if (import.meta.env.DEV) console.log(`[UPLOAD] Tentando R2 proxy (property: ${effectivePropertyId}, temp=${!options?.propertyId})...`);
      setUploadProgress(30);
      result = await uploadToR2Proxy(file, effectivePropertyId);
      setUploadProgress(80);

      if (!result) {
        if (import.meta.env.DEV) console.log('[UPLOAD] R2 falhou. Tentando Cloudinary como fallback...');
        setUploadProgress(50);
        const orgFolder = options?.organizationId ? `${folder}/${options.organizationId}` : folder;
        result = await uploadToCloudinary(file, orgFolder);
        setUploadProgress(90);
      }

      if (!result) {
        console.error('[UPLOAD] Falha em todos os providers (R2 + Cloudinary)');
        toast({ title: 'Erro no upload', description: 'Falha ao enviar imagem. Verifique sua conexão e tente novamente.', variant: 'destructive' });
        return null;
      }

      setUploadProgress(100);
      if (import.meta.env.DEV) console.log(`[UPLOAD] Concluído via ${result.storageProvider}: ${result.url}`);
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
    options?: {
      organizationId?: string;
      skipDuplicateCheck?: boolean;
      excludePropertyId?: string;
      propertyId?: string;
    },
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
    if (import.meta.env.DEV) console.log('Imagem marcada para remoção:', publicId);
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
