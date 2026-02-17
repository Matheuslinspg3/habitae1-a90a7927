export const AUTH_PROTECTION_CONFIG = {
  captchaThresholdSession: 3,
  captchaThresholdIp: 5,
  lockoutThresholdSession: 7,
  lockoutThresholdIp: 10,
  lockoutWindowMinutes: 15,
  lockoutDurationMinutes: 15,
} as const;

export interface AuthRiskStatus {
  failedAttemptsSession: number;
  failedAttemptsIpWindow: number;
  lockoutUntil: string | null;
}

export function shouldRequireCaptcha(status: AuthRiskStatus): boolean {
  return (
    status.failedAttemptsSession >= AUTH_PROTECTION_CONFIG.captchaThresholdSession ||
    status.failedAttemptsIpWindow >= AUTH_PROTECTION_CONFIG.captchaThresholdIp
  );
}

export function isCurrentlyLocked(lockoutUntil: string | null, now = new Date()): boolean {
  if (!lockoutUntil) {
    return false;
  }

  const until = new Date(lockoutUntil);
  return Number.isFinite(until.getTime()) && until.getTime() > now.getTime();
}

export function getSafeAuthErrorMessage(): string {
  return "Não foi possível autenticar com os dados informados.";
}

export function getLockoutMessage(lockoutUntil: string): string {
  const lockoutDate = new Date(lockoutUntil);
  const hh = String(lockoutDate.getHours()).padStart(2, "0");
  const mm = String(lockoutDate.getMinutes()).padStart(2, "0");

  return `Muitas tentativas. Tente novamente após ${hh}:${mm}.`;
}

export function normalizeEmailForAudit(email: string): string {
  return email.trim().toLowerCase();
}
