import { PDFDocument } from 'pdf-lib';

/**
 * Method 1: Compress PDF by re-serializing it (strips unused objects, optimizes structure)
 */
export async function compressPdf(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  
  // Re-serialize to strip unused objects and compress
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,      // Better compression
    addDefaultPage: false,
  });
  
  return compressedBytes;
}

/**
 * Method 3: Split PDF into chunks of N pages each
 * Returns an array of Uint8Array, each representing a chunk
 */
export async function splitPdfIntoChunks(
  file: File,
  pagesPerChunk: number = 10
): Promise<{ chunks: Uint8Array[]; totalPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = sourcePdf.getPageCount();
  
  if (totalPages <= pagesPerChunk) {
    // No need to split — just compress and return as single chunk
    const compressed = await sourcePdf.save({ useObjectStreams: true, addDefaultPage: false });
    return { chunks: [compressed], totalPages };
  }
  
  const chunks: Uint8Array[] = [];
  
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    const chunkPdf = await PDFDocument.create();
    
    const pageIndices = Array.from({ length: end - start }, (_, i) => start + i);
    const copiedPages = await chunkPdf.copyPages(sourcePdf, pageIndices);
    
    copiedPages.forEach(page => chunkPdf.addPage(page));
    
    const chunkBytes = await chunkPdf.save({ useObjectStreams: true, addDefaultPage: false });
    chunks.push(chunkBytes);
  }
  
  return { chunks, totalPages };
}

/**
 * Method 2: Upload PDF to Cloud Storage and return the path
 */
export async function uploadPdfToStorage(
  supabase: any,
  file: File | Uint8Array,
  fileName: string
): Promise<{ path: string; signedUrl: string }> {
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${timestamp}_${safeName}`;
  
  const blob = file instanceof Uint8Array
    ? new Blob([file.buffer as ArrayBuffer], { type: 'application/pdf' })
    : file;
  
  const { error: uploadError } = await supabase.storage
    .from('pdf-imports')
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: false,
    });
  
  if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);
  
  // Create a signed URL valid for 10 minutes (for the edge function to download)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('pdf-imports')
    .createSignedUrl(path, 600); // 10 min
  
  if (signedError) throw new Error(`Signed URL falhou: ${signedError.message}`);
  
  return { path, signedUrl: signedData.signedUrl };
}

/**
 * Cleanup: remove uploaded PDF from storage after processing
 */
export async function deletePdfFromStorage(supabase: any, path: string): Promise<void> {
  await supabase.storage.from('pdf-imports').remove([path]);
}

/**
 * Get PDF page count without loading full document
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

/**
 * Get compressed size estimate
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
