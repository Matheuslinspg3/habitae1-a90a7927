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

async function uploadToR2WithPresign(
  file: File,
  propertyId: string,
): Promise<UploadedImage | null> {
  // 1. Get presigned URLs
  const presigned = await getPresignedUrls(propertyId, [
    { mimeType: file.type, sizeBytes: file.size },
  ]);

  if (!presigned || presigned.length === 0) return null;
  const p = presigned[0];

  // 2. Generate thumb + full variants client-side
  let variants;
  try {
    variants = await generateImageVariants(file);
  } catch (e) {
    console.error('Variant generation failed:', e);
    return null;
  }

  // 3. Upload both variants in parallel
  const [fullOk, thumbOk] = await Promise.all([
    uploadBlobToPresignedUrl(variants.full.blob, p.presignedPutUrlFull, p.requiredHeaders),
    uploadBlobToPresignedUrl(variants.thumb.blob, p.presignedPutUrlThumb, p.requiredHeaders),
  ]);

  if (!fullOk || !thumbOk) {
    console.error(`R2 upload partial failure: full=${fullOk}, thumb=${thumbOk}`);
    return null;
  }

  const fullKB = (variants.full.blob.size / 1024).toFixed(0);
  const thumbKB = (variants.thumb.blob.size / 1024).toFixed(0);
  console.log(`[R2] Upload OK: full=${fullKB}KB, thumb=${thumbKB}KB, key=${p.r2KeyFull}`);

  return {
    url: p.publicUrlFull,
    publicId: p.r2KeyFull,
    storageProvider: 'r2',
    r2KeyFull: p.r2KeyFull,
    r2KeyThumb: p.r2KeyThumb,
    publicUrlThumb: p.publicUrlThumb,
  };
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
    const errorData = await response.json();
    console.error('Cloudinary upload error:', errorData);
    return null;
  }

  const result = await response.json();
  console.log(`[UPLOAD] Cloudinary OK: ${(result.bytes / 1024).toFixed(0)}KB stored`);

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
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Erro no upload', description: 'A imagem deve ter no máximo 10MB', variant: 'destructive' });
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
      setUploadProgress(25);

      // ─── Step 3: Upload (R2 presigned primary, Cloudinary fallback) ───
      let result: UploadedImage | null = null;

      if (options?.propertyId) {
        console.log(`[UPLOAD] Tentando R2 presigned (property: ${options.propertyId})...`);
        setUploadProgress(30);
        result = await uploadToR2WithPresign(file, options.propertyId);
        setUploadProgress(80);
      }

      if (!result) {
        console.log('[UPLOAD] R2 não disponível ou falhou. Tentando Cloudinary...');
        setUploadProgress(50);
        const orgFolder = options?.organizationId ? `${folder}/${options.organizationId}` : folder;
        result = await uploadToCloudinary(file, orgFolder);
        setUploadProgress(90);
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
