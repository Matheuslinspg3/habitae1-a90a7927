import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..", "..");
const supabaseConfig = readFileSync(resolve(repoRoot, "supabase/config.toml"), "utf-8");

function parseVerifyJwtFalseFunctions(toml: string): string[] {
  const lines = toml.split(/\r?\n/);
  const falseFunctions: string[] = [];
  let currentFunction: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/^\[functions\.([a-z0-9-]+)\]$/i);
    if (sectionMatch) {
      currentFunction = sectionMatch[1];
      continue;
    }

    if (currentFunction && line === "verify_jwt = false") {
      falseFunctions.push(currentFunction);
    }
  }

  return falseFunctions.sort();
}

describe("Regressão de auth — verify_jwt", () => {
  it("mantém lista explícita e mínima de funções públicas", () => {
    const functionsWithVerifyJwtFalse = parseVerifyJwtFalseFunctions(supabaseConfig);

    expect(functionsWithVerifyJwtFalse).toEqual(["admin-users", "platform-signup"]);
  });

  it("não permite wildcard/global verify_jwt no config", () => {
    expect(supabaseConfig).not.toMatch(/\[functions\]\s*[\s\S]*verify_jwt\s*=\s*false/i);
  });
});
