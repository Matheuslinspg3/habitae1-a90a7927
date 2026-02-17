/**
 * Structured JSON logger with redaction for Supabase Edge Functions.
 * Usage:
 *   import { createLogger } from "../_shared/logger.ts";
 *   const log = createLogger("billing", req);
 *   log.info("Payment processed", { amount: 100 });
 *   log.error("Webhook failed", { error_code: "TIMEOUT" });
 */

const PII_KEYS = new Set([
  "password", "token", "authorization", "secret", "api_key", "apikey",
  "cpf", "cnpj", "card_number", "cvv", "email", "phone", "telefone",
  "access_token", "refresh_token", "cookie", "x-imobzi-secret",
]);

const PII_PATTERNS = [
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,       // CPF
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, // CNPJ
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // email
];

export function sanitize(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      let sanitized = value;
      for (const pattern of PII_PATTERNS) {
        sanitized = sanitized.replace(pattern, "[REDACTED]");
      }
      result[key] = sanitized;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitize(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

interface LogContext {
  service: string;
  request_id: string;
  trace_id: string;
  route?: string;
  method?: string;
  env: string;
}

interface Logger {
  info(message: string, payload?: Record<string, unknown>): void;
  warn(message: string, payload?: Record<string, unknown>): void;
  error(message: string, payload?: Record<string, unknown>): void;
  context: LogContext;
}

export function createLogger(service: string, req?: Request): Logger {
  const requestId = req?.headers.get("x-request-id") ?? crypto.randomUUID();
  const traceparent = req?.headers.get("traceparent");
  const traceId = traceparent?.split("-")[1] ?? crypto.randomUUID().replace(/-/g, "");
  const env = Deno.env.get("ENVIRONMENT") || "production";
  
  let route: string | undefined;
  let method: string | undefined;
  if (req) {
    try {
      route = new URL(req.url).pathname;
    } catch { /* ignore */ }
    method = req.method;
  }

  const ctx: LogContext = { service, request_id: requestId, trace_id: traceId, route, method, env };

  function emit(level: string, message: string, payload: Record<string, unknown> = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...ctx,
      message,
      ...sanitize(payload),
    };
    if (level === "error") {
      console.error(JSON.stringify(entry));
    } else if (level === "warn") {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  return {
    info: (msg, payload) => emit("info", msg, payload),
    warn: (msg, payload) => emit("warn", msg, payload),
    error: (msg, payload) => emit("error", msg, payload),
    context: ctx,
  };
}
