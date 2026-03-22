import { describe, expect, it } from "vitest";
import {
  defaultRateLimitConfig,
  evaluateProtection,
  parseAllowedOrigins,
  summarizeAttempts,
  type SignupAttemptRecord,
} from "./security";

describe("platform-signup security", () => {
  it("enforces rate limit by ip and invite", () => {
    const now = new Date("2026-02-18T10:00:00.000Z");
    const attempts: SignupAttemptRecord[] = Array.from({ length: 8 }).map((_, index) => ({
      created_at: new Date(now.getTime() - index * 1000).toISOString(),
      ip_address: "203.0.113.10",
      invite_id: "invite-a",
      outcome: "failure",
    }));

    const summary = summarizeAttempts(attempts, "invite-a", "203.0.113.10", now, defaultRateLimitConfig);
    const decision = evaluateProtection(summary, defaultRateLimitConfig);

    expect(summary.attemptsByIp).toBe(8);
    expect(summary.attemptsByInvite).toBe(8);
    expect(decision.blockedByRateLimit).toBe(true);
  });

  it("requires anti-automation challenge after repeated failures", () => {
    const now = new Date("2026-02-18T10:00:00.000Z");
    const attempts: SignupAttemptRecord[] = [
      {
        created_at: new Date(now.getTime() - 1000).toISOString(),
        ip_address: "198.51.100.8",
        invite_id: "invite-b",
        outcome: "failure",
      },
      {
        created_at: new Date(now.getTime() - 2000).toISOString(),
        ip_address: "198.51.100.8",
        invite_id: "invite-b",
        outcome: "challenge_required",
      },
      {
        created_at: new Date(now.getTime() - 3000).toISOString(),
        ip_address: "198.51.100.8",
        invite_id: "invite-c",
        outcome: "failure",
      },
    ];

    const summary = summarizeAttempts(attempts, "invite-b", "198.51.100.8", now, defaultRateLimitConfig);
    const decision = evaluateProtection(summary, defaultRateLimitConfig);

    expect(summary.failuresByIp).toBe(3);
    expect(decision.requiresChallenge).toBe(true);
  });

  it("detects suspicious patterns for anomaly alerts", () => {
    const now = new Date("2026-02-18T10:00:00.000Z");
    const inviteIds = ["inv-1", "inv-2", "inv-3", "inv-4"];
    const attempts: SignupAttemptRecord[] = inviteIds.map((inviteId, index) => ({
      created_at: new Date(now.getTime() - index * 1000).toISOString(),
      ip_address: "192.0.2.20",
      invite_id: inviteId,
      outcome: "failure",
    }));

    const summary = summarizeAttempts(attempts, "inv-1", "192.0.2.20", now, defaultRateLimitConfig);
    const decision = evaluateProtection(summary, defaultRateLimitConfig);

    expect(summary.distinctInvitesForIp).toBe(4);
    expect(decision.anomalyDetected).toBe(true);
  });

  it("parses allowed origins from env configuration", () => {
    const origins = parseAllowedOrigins("https://app.habitae.com,https://staging.habitae.com", "production");
    expect(origins).toEqual(["https://app.habitae.com", "https://staging.habitae.com"]);
    expect(parseAllowedOrigins(undefined, "development")).toContain("http://localhost:5173");
  });
});
