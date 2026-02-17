import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";

describe("Frontend CSP headers", () => {
  it("aplica Content-Security-Policy rígido no server/preview", () => {
    const config = viteConfig({ mode: "test", command: "serve" } as any);
    const csp = config.server?.headers?.["Content-Security-Policy"];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");

    expect(config.preview?.headers?.["Content-Security-Policy"]).toBe(csp);
  });
});
