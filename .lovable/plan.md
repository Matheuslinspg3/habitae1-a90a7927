

## Problem

The R2 presigned URL upload flow fails because the R2 bucket does not have CORS configured, causing browser `PUT` requests to be blocked. Cloudinary (the fallback) is also disabled ("cloud_name is disabled"). Result: no image uploads work.

## Solution

Replace the client-side presigned URL upload with a **server-side proxy** approach using the existing `r2-upload` edge function. This avoids CORS entirely since the upload goes through the edge function (server-to-server to R2).

## Changes

### 1. Update `r2-upload` edge function to support the two-variant pattern

The current `r2-upload` accepts a single file via FormData. We need to update it to:
- Accept two files (`full` and `thumb`) in one request, both as WebP blobs
- Accept an optional `propertyId` to build the correct key path (`imoveis/{propertyId}/{uuid}_full.webp`)
- Return both public URLs and R2 keys in the response

### 2. Update `useImageUpload.ts` client-side upload logic

Replace the `uploadToR2WithPresign` function with a new `uploadToR2Proxy` function that:
- Generates image variants client-side (full + thumb WebP) as it does today
- Sends both blobs to the `r2-upload` edge function via FormData (server-side proxy)
- Returns the same `UploadedImage` shape with `r2KeyFull`, `r2KeyThumb`, public URLs

The presigned URL flow (`getPresignedUrls`, `uploadBlobToPresignedUrl`) will remain in the code but won't be called -- the proxy is used instead.

### 3. Keep Cloudinary as last-resort fallback

The existing Cloudinary fallback stays in place. If R2 proxy also fails, it tries Cloudinary (which will likely fail too since the account is disabled, but it's harmless to keep).

---

### Technical Details

**`supabase/functions/r2-upload/index.ts`** changes:
- Accept `full` and `thumb` File fields from FormData, plus a `propertyId` string field
- Generate a UUID upload ID
- Build keys: `imoveis/{propertyId}/{uploadId}_full.webp` and `_thumb.webp`
- Upload both to R2 server-side using SigV4
- Return `{ r2KeyFull, r2KeyThumb, publicUrlFull, publicUrlThumb, uploadId }`

**`src/hooks/useImageUpload.ts`** changes:
- New `uploadToR2Proxy(file, propertyId)` function that:
  1. Calls `generateImageVariants(file)` for full + thumb blobs
  2. Builds a FormData with both blobs + propertyId
  3. Calls `supabase.functions.invoke('r2-upload', { body: formData })` 
  4. Returns the `UploadedImage` result
- `uploadImage` calls `uploadToR2Proxy` instead of `uploadToR2WithPresign`

