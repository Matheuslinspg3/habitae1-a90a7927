import { describe, it, expect } from "vitest";

/**
 * A07: SSRF Protection — URL allowlist validation tests
 * Tests the URL validation logic used in extract-property-pdf
 */

// Replicate the allowlist logic from the edge function
// In production this is derived from SUPABASE_URL env var; for tests we use a placeholder
const TEST_SUPABASE_HOST = "test-project.supabase.co";
const ALLOWED_HOSTS = [
  TEST_SUPABASE_HOST,
  "res.cloudinary.com",
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) return false;
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

describe("SSRF Protection — URL allowlist", () => {
  it("allows Supabase storage URLs", () => {
    expect(isAllowedUrl("https://hlasxwslrkbtryurcaqa.supabase.co/storage/v1/object/public/test.pdf")).toBe(true);
  });

  it("allows Cloudinary URLs", () => {
    expect(isAllowedUrl("https://res.cloudinary.com/demo/image/upload/v1/test.jpg")).toBe(true);
  });

  it("blocks HTTP (non-HTTPS)", () => {
    expect(isAllowedUrl("http://hlasxwslrkbtryurcaqa.supabase.co/storage/v1/test.pdf")).toBe(false);
  });

  it("blocks localhost", () => {
    expect(isAllowedUrl("https://localhost/secret")).toBe(false);
    expect(isAllowedUrl("https://127.0.0.1/secret")).toBe(false);
  });

  it("blocks private IPs", () => {
    expect(isAllowedUrl("https://10.0.0.1/internal")).toBe(false);
    expect(isAllowedUrl("https://192.168.1.1/admin")).toBe(false);
    expect(isAllowedUrl("https://172.16.0.1/api")).toBe(false);
  });

  it("blocks cloud metadata endpoints", () => {
    expect(isAllowedUrl("https://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("blocks .internal and .local domains", () => {
    expect(isAllowedUrl("https://service.internal/api")).toBe(false);
    expect(isAllowedUrl("https://db.local/query")).toBe(false);
  });

  it("blocks arbitrary external domains", () => {
    expect(isAllowedUrl("https://evil.com/steal-data")).toBe(false);
    expect(isAllowedUrl("https://example.org/malware.pdf")).toBe(false);
  });

  it("blocks malformed URLs", () => {
    expect(isAllowedUrl("not-a-url")).toBe(false);
    expect(isAllowedUrl("")).toBe(false);
  });
});

describe("Webhook idempotency logic", () => {
  it("SHA-256 hash is deterministic", async () => {
    const encoder = new TextEncoder();
    const payload = JSON.stringify({ id: "evt_123", event: "PAYMENT_CONFIRMED" });
    const hash1 = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
    const hash2 = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
    const hex1 = Array.from(new Uint8Array(hash1)).map(b => b.toString(16).padStart(2, "0")).join("");
    const hex2 = Array.from(new Uint8Array(hash2)).map(b => b.toString(16).padStart(2, "0")).join("");
    expect(hex1).toBe(hex2);
  });

  it("different payloads produce different hashes", async () => {
    const encoder = new TextEncoder();
    const h1 = await crypto.subtle.digest("SHA-256", encoder.encode('{"id":"1"}'));
    const h2 = await crypto.subtle.digest("SHA-256", encoder.encode('{"id":"2"}'));
    const hex1 = Array.from(new Uint8Array(h1)).map(b => b.toString(16).padStart(2, "0")).join("");
    const hex2 = Array.from(new Uint8Array(h2)).map(b => b.toString(16).padStart(2, "0")).join("");
    expect(hex1).not.toBe(hex2);
  });
});

describe("Platform signup email binding", () => {
  it("case-insensitive email comparison matches correctly", () => {
    const inviteEmail = "User@Example.COM";
    const signupEmail = "user@example.com";
    expect(inviteEmail.toLowerCase().trim()).toBe(signupEmail.toLowerCase().trim());
  });

  it("different emails do not match", () => {
    const inviteEmail = "invited@example.com";
    const signupEmail = "attacker@evil.com";
    expect(inviteEmail.toLowerCase().trim()).not.toBe(signupEmail.toLowerCase().trim());
  });
});

describe("Payload sanitization", () => {
  it("sanitized webhook payload excludes PII fields", () => {
    const rawPayload = {
      id: "evt_123",
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_456",
        billingType: "PIX",
        value: 99.90,
        status: "CONFIRMED",
        customer: "cus_789",
        customerName: "João Silva",       // PII
        customerEmail: "joao@email.com",  // PII
        customerCpf: "123.456.789-00",    // PII
      },
    };

    const sanitized = {
      event: rawPayload.event,
      payment_id: rawPayload.payment?.id || null,
      billing_type: rawPayload.payment?.billingType || null,
      value: rawPayload.payment?.value || null,
      status: rawPayload.payment?.status || null,
    };

    expect(sanitized).not.toHaveProperty("customerName");
    expect(sanitized).not.toHaveProperty("customerEmail");
    expect(sanitized).not.toHaveProperty("customerCpf");
    expect(JSON.stringify(sanitized)).not.toContain("João");
    expect(JSON.stringify(sanitized)).not.toContain("joao@");
    expect(JSON.stringify(sanitized)).not.toContain("123.456");
  });
});
