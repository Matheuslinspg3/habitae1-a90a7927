import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um número como moeda brasileira (R$)
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata um número como porcentagem brasileira
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0%";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

/**
 * Formata uma data no padrão brasileiro (dd/mm/aaaa)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(dateObj);
}

/**
 * Formata uma data com hora no padrão brasileiro
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

/**
 * Parsea uma string de moeda BR para número
 */
export function parseCurrency(value: string): number {
  // Remove R$, espaços e pontos de milhar, troca vírgula por ponto
  const numericString = value
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = parseFloat(numericString);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formata um input de moeda enquanto o usuário digita
 */
export function formatCurrencyInput(value: string): string {
  // Remove tudo que não é número
  const numericValue = value.replace(/\D/g, "");
  if (!numericValue) return "";
  
  // Converte para centavos
  const cents = parseInt(numericValue, 10);
  const reais = cents / 100;
  
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(reais);
}

/**
 * Parsea input de moeda para número (em centavos para reais)
 */
export function parseCurrencyInput(value: string): number {
  const numericValue = value.replace(/\D/g, "");
  if (!numericValue) return 0;
  return parseInt(numericValue, 10) / 100;
}

/**
 * Converts a Google Drive thumbnail URL to a proxied URL via our Edge Function.
 * This bypasses Drive's hotlinking restrictions.
 * Non-Drive URLs are returned as-is.
 */
export function proxyDriveImageUrl(url: string, size: string = "w800"): string {
  if (!url) return url;
  
  // Handle Drive thumbnail URLs (drive.google.com/thumbnail?id=...)
  const thumbMatch = url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (thumbMatch) {
    const fileId = thumbMatch[1];
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/drive-image-proxy?id=${fileId}&sz=${size}`;
  }

  // Handle lh3.googleusercontent.com URLs - these expire, so proxy via drive-image-proxy
  // Pattern 1: /d/{fileId} format
  const lh3Match = url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/);
  if (lh3Match) {
    const fileId = lh3Match[1];
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/drive-image-proxy?id=${fileId}&sz=${size}`;
  }
  // Pattern 2: /drive-storage/ format - these are temporary signed URLs that expire
  // We can't extract a file ID from them, so we pass the full URL as a fallback
  if (url.includes("lh3.googleusercontent.com/drive-storage/")) {
    // These URLs expire - return as-is but the onError fallback in the component will handle it
    // The real fix is to cache them via R2 using the drive_file_id from the database
    return url;
  }
  // Other lh3 URLs pass through
  if (url.includes("lh3.googleusercontent.com")) {
    return url;
  }

  // Handle direct Drive file URLs
  const driveFileMatch = url.match(/drive\.google\.com\/(?:file\/d\/|uc\?.*?id=)([a-zA-Z0-9_-]+)/);
  if (driveFileMatch) {
    const fileId = driveFileMatch[1];
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/drive-image-proxy?id=${fileId}&sz=${size}`;
  }

  return url;
}
