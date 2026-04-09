export type SignupAttemptRecord = {
  created_at: string;
  ip_address: string | null;
  invite_id: string | null;
  outcome: "success" | "failure" | "blocked" | "challenge_required";
};

export type RateLimitConfig = {
  windowMs: number;
  maxAttemptsPerIp: number;
  maxAttemptsPerInvite: number;
  challengeAfterFailures: number;
  anomalyFailuresPerIp: number;
  anomalyDistinctInvitesPerIp: number;
};

export const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxAttemptsPerIp: 8,
  maxAttemptsPerInvite: 6,
  challengeAfterFailures: 3,
  anomalyFailuresPerIp: 12,
  anomalyDistinctInvitesPerIp: 4,
};

export function extractClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }

  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export function parseAllowedOrigins(raw: string | undefined, env = "production"): string[] {
  if (raw && raw.trim().length > 0) {
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  }

  if (env === "development") {
    return ["http://localhost:5173", "http://127.0.0.1:5173"];
  }

  return [];
}

export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

export function summarizeAttempts(
  attempts: SignupAttemptRecord[],
  inviteId: string,
  ipAddress: string,
  now: Date,
  config: RateLimitConfig,
) {
  const threshold = now.getTime() - config.windowMs;
  const windowed = attempts.filter((attempt) => {
    const ts = Date.parse(attempt.created_at);
    return Number.isFinite(ts) && ts >= threshold;
  });

  const attemptsByIp = windowed.filter((attempt) => attempt.ip_address === ipAddress);
  const attemptsByInvite = windowed.filter((attempt) => attempt.invite_id === inviteId);

  const failuresByIp = attemptsByIp.filter((attempt) => attempt.outcome !== "success");

  return {
    attemptsByIp: attemptsByIp.length,
    attemptsByInvite: attemptsByInvite.length,
    failuresByIp: failuresByIp.length,
    distinctInvitesForIp: new Set(
      attemptsByIp.map((attempt) => attempt.invite_id).filter((id): id is string => Boolean(id)),
    ).size,
  };
}

export function evaluateProtection(summary: ReturnType<typeof summarizeAttempts>, config: RateLimitConfig) {
  const blockedByRateLimit =
    summary.attemptsByIp >= config.maxAttemptsPerIp ||
    summary.attemptsByInvite >= config.maxAttemptsPerInvite;

  const requiresChallenge = summary.failuresByIp >= config.challengeAfterFailures;

  const anomalyDetected =
    summary.failuresByIp >= config.anomalyFailuresPerIp ||
    summary.distinctInvitesForIp >= config.anomalyDistinctInvitesPerIp;

  return {
    blockedByRateLimit,
    requiresChallenge,
    anomalyDetected,
  };
}
