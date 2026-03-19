const GEMINI_OPENAI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const DEFAULT_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation";

interface RetryableGeminiOptions {
  preferredKeys?: Array<string | null | undefined>;
}

interface GeminiOpenAIChatOptions extends RetryableGeminiOptions {
  body: Record<string, unknown>;
}

interface GeminiImageEditOptions extends RetryableGeminiOptions {
  prompt: string;
  imageUrl: string;
  model?: string;
}

function uniqueKeys(keys: Array<string | null | undefined>): string[] {
  return [...new Set(keys.map((key) => key?.trim()).filter((key): key is string => Boolean(key)))];
}

export function getGeminiApiKeys(options: RetryableGeminiOptions = {}): string[] {
  return uniqueKeys([
    ...(options.preferredKeys || []),
    Deno.env.get("GOOGLE_AI_KEY_1"),
    Deno.env.get("GOOGLE_AI_KEY_2"),
  ]);
}

export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

    const mimeType = (response.headers.get("content-type") || "image/png").split(";")[0];
    if (!mimeType.startsWith("image/")) {
      throw new Error("Provided URL is not an image");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary);
    return `data:${mimeType};base64,${base64}`;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callGeminiOpenAIChat(options: GeminiOpenAIChatOptions): Promise<any> {
  const keys = getGeminiApiKeys(options);
  if (keys.length === 0) {
    throw new Error("Google AI keys not configured");
  }

  const body = {
    model: DEFAULT_TEXT_MODEL,
    ...options.body,
  };

  let lastError: Error | null = null;

  for (const [index, apiKey] of keys.entries()) {
    try {
      const response = await fetch(GEMINI_OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429 || response.status >= 500) {
        const errorText = await response.text();
        console.warn(`Gemini key ${index + 1} retryable error: ${response.status} ${errorText.slice(0, 300)}`);
        lastError = new Error(`Gemini retryable error: ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini error ${response.status}: ${errorText.slice(0, 500)}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Gemini request failed with key ${index + 1}:`, lastError.message);
    }
  }

  throw lastError || new Error("Gemini request failed");
}

export async function callGeminiImageEdit(options: GeminiImageEditOptions): Promise<{ imageDataUrl: string; text: string }> {
  const keys = getGeminiApiKeys(options);
  if (keys.length === 0) {
    throw new Error("Google AI keys not configured");
  }

  const imageDataUrl = await fetchImageAsDataUrl(options.imageUrl);
  const [, mimeType = "image/png", base64Data = ""] = imageDataUrl.match(/^data:(.*?);base64,(.*)$/) || [];
  const model = options.model || DEFAULT_IMAGE_MODEL;
  let lastError: Error | null = null;

  for (const [index, apiKey] of keys.entries()) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: options.prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        },
      );

      if (response.status === 429 || response.status >= 500) {
        const errorText = await response.text();
        console.warn(`Gemini image key ${index + 1} retryable error: ${response.status} ${errorText.slice(0, 300)}`);
        lastError = new Error(`Gemini image retryable error: ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini image error ${response.status}: ${errorText.slice(0, 500)}`);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.filter((part: any) => typeof part.text === "string").map((part: any) => part.text).join("\n").trim();
      const imagePart = parts.find((part: any) => part.inlineData?.data);

      if (!imagePart?.inlineData?.data) {
        throw new Error("Gemini image response did not include image data");
      }

      return {
        imageDataUrl: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
        text,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Gemini image request failed with key ${index + 1}:`, lastError.message);
    }
  }

  throw lastError || new Error("Gemini image request failed");
}
