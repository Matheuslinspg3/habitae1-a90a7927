import { describe, expect, it } from "vitest";
import {
  AUTH_PROTECTION_CONFIG,
  getLockoutMessage,
  getSafeAuthErrorMessage,
  isCurrentlyLocked,
  normalizeEmailForAudit,
  shouldRequireCaptcha,
} from "@/lib/authProtection";

describe("authProtection", () => {
  it("ativa CAPTCHA quando limiar de sessão é atingido", () => {
    expect(
      shouldRequireCaptcha({
        failedAttemptsSession: AUTH_PROTECTION_CONFIG.captchaThresholdSession,
        failedAttemptsIpWindow: 0,
        lockoutUntil: null,
      }),
    ).toBe(true);
  });

  it("ativa CAPTCHA quando limiar de IP é atingido", () => {
    expect(
      shouldRequireCaptcha({
        failedAttemptsSession: 0,
        failedAttemptsIpWindow: AUTH_PROTECTION_CONFIG.captchaThresholdIp,
        lockoutUntil: null,
      }),
    ).toBe(true);
  });

  it("detecta lockout ativo", () => {
    const now = new Date("2026-01-01T10:00:00.000Z");
    const lockoutUntil = "2026-01-01T10:05:00.000Z";
    expect(isCurrentlyLocked(lockoutUntil, now)).toBe(true);
  });

  it("retorna mensagem de erro segura", () => {
    expect(getSafeAuthErrorMessage()).toContain("Não foi possível autenticar");
  });

  it("normaliza email para auditoria", () => {
    expect(normalizeEmailForAudit("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("formata mensagem de lockout", () => {
    const msg = getLockoutMessage("2026-01-01T10:15:00.000Z");
    expect(msg).toContain("10:15");
  });
});
