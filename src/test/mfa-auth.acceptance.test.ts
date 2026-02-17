import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildRecoveryCodeSet,
  clearStepUp,
  hasRecentStepUp,
  isMfaRequiredForRoles,
  isSessionMfaVerified,
  markStepUp,
} from "@/lib/mfa";

const createJwt = (payload: Record<string, unknown>) => {
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `x.${encoded}.y`;
};

describe("MFA acceptance — login com e sem MFA", () => {
  it("roles admin/leader/developer exigem MFA", () => {
    expect(isMfaRequiredForRoles(["admin"])) .toBe(true);
    expect(isMfaRequiredForRoles(["leader"])) .toBe(true);
    expect(isMfaRequiredForRoles(["developer"])) .toBe(true);
    expect(isMfaRequiredForRoles(["corretor"])) .toBe(false);
  });

  it("sessão em aal1 não está verificada; aal2 está verificada", () => {
    const aal1 = createJwt({ aal: "aal1" });
    const aal2 = createJwt({ aal: "aal2" });

    expect(isSessionMfaVerified(aal1)).toBe(false);
    expect(isSessionMfaVerified(aal2)).toBe(true);
  });
});

describe("MFA acceptance — step-up em ações críticas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearStepUp();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearStepUp();
  });

  it("marca step-up recente e expira após janela de segurança", () => {
    expect(hasRecentStepUp()).toBe(false);

    markStepUp();
    expect(hasRecentStepUp()).toBe(true);

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(hasRecentStepUp()).toBe(false);
  });
});

describe("MFA acceptance — recovery codes", () => {
  it("gera conjunto único de códigos para recuperação segura", () => {
    const codes = buildRecoveryCodeSet(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    expect(codes.every((item) => /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(item))).toBe(true);
  });
});
