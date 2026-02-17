import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_STORAGE_STRATEGY_KEY,
  createAuthStorage,
  getAuthStorageStrategy,
  setAuthStorageStrategy,
} from "@/integrations/supabase/client";

describe("Auth storage strategy integration", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("persiste sessão em localStorage quando 'Lembrar-me' está ativo", () => {
    const storage = createAuthStorage();
    const authKey = "sb-project-auth-token";

    setAuthStorageStrategy("local");
    storage.setItem(authKey, "token-local");

    expect(localStorage.getItem(authKey)).toBe("token-local");
    expect(sessionStorage.getItem(authKey)).toBeNull();

    // Simula refresh: mesma aba e mesmo armazenamento persistido
    const refreshedStorage = createAuthStorage();
    expect(refreshedStorage.getItem(authKey)).toBe("token-local");
  });

  it("persiste sessão em sessionStorage quando 'Lembrar-me' está desativado", () => {
    const storage = createAuthStorage();
    const authKey = "sb-project-auth-token";

    setAuthStorageStrategy("session");
    storage.setItem(authKey, "token-session");

    expect(sessionStorage.getItem(authKey)).toBe("token-session");
    expect(localStorage.getItem(authKey)).toBeNull();

    // Refresh mantém sessionStorage na mesma aba
    const refreshedStorage = createAuthStorage();
    expect(refreshedStorage.getItem(authKey)).toBe("token-session");
  });

  it("encerra sessão não lembrada após fechamento de aba", () => {
    const storage = createAuthStorage();
    const authKey = "sb-project-auth-token";

    setAuthStorageStrategy("session");
    storage.setItem(authKey, "token-session");

    // Simula fechamento da aba/janela
    sessionStorage.clear();

    const nextTabStorage = createAuthStorage();
    expect(nextTabStorage.getItem(authKey)).toBeNull();
    expect(localStorage.getItem(authKey)).toBeNull();
  });

  it("migra token entre storages ao trocar estratégia", () => {
    const authKey = "sb-project-auth-token";
    localStorage.setItem(authKey, "token-local");

    setAuthStorageStrategy("session");
    expect(sessionStorage.getItem(authKey)).toBe("token-local");
    expect(localStorage.getItem(authKey)).toBeNull();

    setAuthStorageStrategy("local");
    expect(localStorage.getItem(authKey)).toBe("token-local");
    expect(sessionStorage.getItem(authKey)).toBeNull();
    expect(getAuthStorageStrategy()).toBe("local");
    expect(localStorage.getItem(AUTH_STORAGE_STRATEGY_KEY)).toBe("local");
  });
});
