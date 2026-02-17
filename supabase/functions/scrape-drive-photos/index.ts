import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Google Drive API: list image files in a folder ──
async function listDriveFiles(folderId: string, apiKey: string): Promise<{ id: string; name: string; mimeType: string; thumbnailLink?: string }[]> {
  const fields = "files(id,name,mimeType,thumbnailLink)";
  const query = `'${folderId}' in parents and mimeType contains 'image/'`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${apiKey}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=name`;

  console.log(`Drive API: listing image files in folder ${folderId}`);
  const resp = await fetch(url);

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Drive API error ${resp.status}: ${errText}`);
    if (resp.status === 404) return [];
    if (resp.status === 403 || resp.status === 401) throw new Error("PRIVATE_FOLDER");
    throw new Error(`Drive API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.files || [];
}

// ── Google Drive API: list subfolders in a folder ──
async function listDriveSubfolders(folderId: string, apiKey: string): Promise<{ id: string; name: string }[]> {
  const query = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${apiKey}&fields=${encodeURIComponent("files(id,name)")}&pageSize=100&orderBy=name`;

  console.log(`Drive API: listing subfolders in folder ${folderId}`);
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.files || [];
}

// ── Recursively list images: direct files first, then subfolders (1 level deep) ──
async function listDriveImagesRecursive(
  folderId: string, apiKey: string, maxDepth = 1
): Promise<{ id: string; name: string; mimeType: string; thumbnailLink?: string; subfolder?: string }[]> {
  // First try direct image files
  let files = await listDriveFiles(folderId, apiKey);
  
  if (files.length > 0) {
    console.log(`Found ${files.length} images directly in folder`);
    return files;
  }

  // No direct images — check subfolders
  if (maxDepth <= 0) return [];

  const subfolders = await listDriveSubfolders(folderId, apiKey);
  console.log(`No direct images. Found ${subfolders.length} subfolders to check.`);

  const allFiles: { id: string; name: string; mimeType: string; thumbnailLink?: string; subfolder?: string }[] = [];

  for (const sub of subfolders) {
    try {
      const subFiles = await listDriveFiles(sub.id, apiKey);
      console.log(`  Subfolder "${sub.name}": ${subFiles.length} images`);
      for (const f of subFiles) {
        allFiles.push({ ...f, subfolder: sub.name });
      }
    } catch (e) {
      console.warn(`  Error reading subfolder "${sub.name}":`, (e as Error).message);
    }
  }

  return allFiles;
}

// ── Get subfolders for per-property matching ──
async function listSubfoldersForMatching(folderId: string, apiKey: string): Promise<{ id: string; name: string; imageCount: number }[]> {
  const subfolders = await listDriveSubfolders(folderId, apiKey);
  const results: { id: string; name: string; imageCount: number }[] = [];

  for (const sub of subfolders) {
    try {
      const files = await listDriveFiles(sub.id, apiKey);
      results.push({ id: sub.id, name: sub.name, imageCount: files.length });
    } catch {
      results.push({ id: sub.id, name: sub.name, imageCount: 0 });
    }
  }

  return results;
}

// ── Validate folder access ──
async function checkFolderAccess(folderId: string, apiKey: string): Promise<"public" | "private" | "not_found"> {
  const url = `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(folderId)}'+in+parents&key=${apiKey}&pageSize=1&fields=files(id)`;
  const resp = await fetch(url);
  if (resp.ok) return "public";
  if (resp.status === 404) return "not_found";
  return "private";
}

function extractFolderIdFromUrl(url: string): string | null {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/folderview\?id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Use service role for DB operations (user auth is validated separately)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate user auth
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!DRIVE_API_KEY) {
      return new Response(JSON.stringify({ error: "Chave da API do Google Drive não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { url, property_id, max_photos = 20, mode = "reference", file_ids: providedFileIds, check_access, list_subfolders } = body;

    console.log("Request:", JSON.stringify({
      url: url?.substring(0, 80),
      property_id,
      max_photos,
      mode,
      file_ids_count: providedFileIds?.length,
      check_access,
      list_subfolders,
    }));

    // ── Access check mode ──
    if (check_access && url) {
      const folderId = extractFolderIdFromUrl(url);
      if (!folderId) {
        return new Response(JSON.stringify({ access: "invalid_url" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const access = await checkFolderAccess(folderId, DRIVE_API_KEY);
      
      // Also check if folder has subfolders (for per-property matching)
      let subfolders: { id: string; name: string; imageCount: number }[] = [];
      if (access === "public") {
        subfolders = await listSubfoldersForMatching(folderId, DRIVE_API_KEY);
      }
      
      return new Response(JSON.stringify({ access, folder_id: folderId, subfolders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── List subfolders mode ──
    if (list_subfolders && url) {
      const folderId = extractFolderIdFromUrl(url);
      if (!folderId) {
        return new Response(JSON.stringify({ error: "URL inválida", subfolders: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const subfolders = await listSubfoldersForMatching(folderId, DRIVE_API_KEY);
      return new Response(JSON.stringify({ success: true, subfolders }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Resolve file IDs ──
    let folderId: string | null = null;
    let files: { id: string; name: string; mimeType: string; thumbnailLink?: string; subfolder?: string }[] = [];

    if (providedFileIds && Array.isArray(providedFileIds) && providedFileIds.length > 0) {
      files = providedFileIds.map((id: string) => ({ id, name: "", mimeType: "image/jpeg" }));
      console.log(`Using ${files.length} provided file IDs`);
    } else {
      if (!url || typeof url !== "string") {
        return new Response(
          JSON.stringify({ error: "URL é obrigatória" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const isGoogleDrive = url.includes("drive.google.com") || url.includes("docs.google.com");
      if (!isGoogleDrive) {
        return new Response(
          JSON.stringify({ error: "Apenas links do Google Drive são suportados", photos: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      folderId = extractFolderIdFromUrl(url);
      if (!folderId) {
        return new Response(
          JSON.stringify({ error: "Não foi possível extrair o ID da pasta", photos: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      try {
        // Use recursive listing to find images in subfolders
        files = await listDriveImagesRecursive(folderId, DRIVE_API_KEY, 1);
      } catch (e) {
        if (e instanceof Error && e.message === "PRIVATE_FOLDER") {
          return new Response(
            JSON.stringify({
              error: "Pasta sem acesso público. Peça ao proprietário para compartilhar com 'Qualquer pessoa com o link'.",
              access: "private",
              photos: [],
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        throw e;
      }

      console.log(`Total images found (including subfolders): ${files.length}`);
    }

    const limitedFiles = files.slice(0, Math.min(max_photos, 50));

    // ── Save references to DB ──
    if (property_id && (mode === "reference" || mode === "download")) {
      console.log(`Saving ${limitedFiles.length} Drive references for property ${property_id}`);
      
      // Delete existing drive references first to avoid duplicates
      await supabase.from("property_images").delete()
        .eq("property_id", property_id)
        .eq("source", "drive-reference");

      const savedPhotos: { url: string; file_id: string; display_order: number }[] = [];

      for (let i = 0; i < limitedFiles.length; i++) {
        const file = limitedFiles[i];
        const thumbnailUrl = file.thumbnailLink
          ? file.thumbnailLink.replace(/=s\d+/, "=s800")
          : `https://lh3.googleusercontent.com/d/${file.id}=w800`;

        const { error: insertErr } = await supabase.from("property_images").insert({
          property_id,
          url: thumbnailUrl,
          display_order: i,
          is_cover: i === 0,
          source: "drive-reference",
          drive_file_id: file.id,
          cache_status: "pending",
        });

        if (insertErr) {
          console.error(`Error saving image reference: ${insertErr.message}`);
        } else {
          savedPhotos.push({ url: thumbnailUrl, file_id: file.id, display_order: i });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          folder_id: folderId,
          total_found: files.length,
          saved: savedPhotos.length,
          mode: "reference",
          photos: savedPhotos,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Preview mode (no property_id) ──
    const photos = limitedFiles.map((file, index) => ({
      url: file.thumbnailLink
        ? file.thumbnailLink.replace(/=s\d+/, "=s800")
        : `https://lh3.googleusercontent.com/d/${file.id}=w800`,
      thumbnail_url: file.thumbnailLink
        ? file.thumbnailLink.replace(/=s\d+/, "=s400")
        : `https://lh3.googleusercontent.com/d/${file.id}=w400`,
      file_id: file.id,
      filename: file.name || `foto_${index + 1}.jpg`,
      subfolder: (file as any).subfolder,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        folder_id: folderId,
        photos,
        total_found: files.length,
        returned: photos.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in scrape-drive-photos:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao acessar pasta de fotos", photos: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
