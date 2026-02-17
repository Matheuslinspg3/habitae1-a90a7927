const MFA_REQUIRED_ROLES = ["admin", "leader", "developer"] as const;
export const STEP_UP_MAX_AGE_MS = 10 * 60 * 1000;

interface JwtPayload {
  aal?: string;
  amr?: Array<{ method?: string } | string>;
  [key: string]: unknown;
}

const safeJsonParse = (value: string): JwtPayload | null => {
  try {
    return JSON.parse(value) as JwtPayload;
  } catch {
    return null;
  }
};

export const decodeJwtPayload = (accessToken?: string | null): JwtPayload | null => {
  if (!accessToken) return null;
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const decoded = atob(padded);
    return safeJsonParse(decoded);
  } catch {
    return null;
  }
};

export const isMfaRequiredForRoles = (roles: string[]) => {
  return roles.some((role) => MFA_REQUIRED_ROLES.includes(role as (typeof MFA_REQUIRED_ROLES)[number]));
};

export const getSessionAAL = (accessToken?: string | null) => {
  const payload = decodeJwtPayload(accessToken);
  return payload?.aal ?? "aal1";
};

export const isSessionMfaVerified = (accessToken?: string | null) => {
  return getSessionAAL(accessToken) === "aal2";
};

export const buildRecoveryCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(""),
  );
  return groups.join("-");
};

export const buildRecoveryCodeSet = (amount = 8) => {
  const values = new Set<string>();
  while (values.size < amount) {
    values.add(buildRecoveryCode());
  }
  return Array.from(values);
};

export const getStepUpTimestamp = () => {
  const raw = sessionStorage.getItem("mfa_step_up_at");
  return raw ? Number(raw) : 0;
};

export const markStepUp = () => {
  sessionStorage.setItem("mfa_step_up_at", String(Date.now()));
};

export const clearStepUp = () => {
  sessionStorage.removeItem("mfa_step_up_at");
};

export const hasRecentStepUp = () => {
  const ts = getStepUpTimestamp();
  return ts > 0 && Date.now() - ts <= STEP_UP_MAX_AGE_MS;
};
