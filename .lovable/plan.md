

## Bug: Duplicated Property Images Not Showing

### Root Cause Analysis

After investigating the database and code, I found **two issues** with the property duplication flow:

**Issue 1 — Silent insert failure (primary bug):**
When duplicating a property, the `createProperty` mutation inserts image records into `property_images`. However, if the insert fails (e.g., due to constraint violations or RLS issues), the error is caught and shown as a toast but execution continues — the property is created without images. The user sees "Imóvel duplicado!" but photos are missing.

**Issue 2 — Shared storage keys cause cascading deletion:**
When a property is duplicated, the new `property_images` rows reference the **same R2 storage keys** (`r2_key_full`, `r2_key_thumb`) as the original. If either property is later deleted:
- The `property_images` rows are deleted (line 471 of `useProperties.ts`)
- The `cleanup-orphan-media` Edge Function runs every 6 hours and finds those R2 keys are now only referenced by one property (or none)
- It may delete the actual files from R2/Cloudinary, breaking images on the surviving property

### Plan

1. **Add error logging and retry for duplicate image insertion**
   - In `PropertyDetails.tsx` `handleDuplicate`, add console logging before calling `createProperty` to trace the images array
   - Ensure `createProperty` surfaces insert errors properly

2. **Copy actual image data, not just references** (main fix)
   - In the `handleDuplicate` function, instead of reusing the same `r2_key_full`/`r2_key_thumb`, generate new image records that only reference the URL (not the R2 keys)
   - This prevents cascading deletion issues: each property's images are independent records pointing to the same URL, but without claiming ownership of the R2 storage keys
   - The `cleanup-orphan-media` function will then correctly identify shared files

3. **Alternative: reference counting for shared images**
   - Too complex for now — the simpler approach is to just copy the URL and mark storage_provider as null (legacy mode) for duplicated images, so they're treated as external URLs rather than R2-managed files

### Technical Changes

**File: `src/pages/PropertyDetails.tsx` (lines 271-279)**
- When mapping images for duplication, **exclude** `r2_key_full`, `r2_key_thumb`, `storage_provider`, and `phash` fields
- Only copy `url`, `is_cover`, and `display_order`
- This ensures duplicated images reference the URL directly without claiming R2 ownership
- If the image has R2 keys, resolve the full URL using `getImageUrl()` before storing

**File: `src/lib/imageUrl.ts`**
- No changes needed — `getImageUrl` already handles fallback to `url` field when R2 keys are absent

This is a minimal, safe fix: duplicated properties will display images correctly via URL, and deleting either property won't affect the other's images.

