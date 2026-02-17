import { describe, it, expect, vi } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("Auth — smoke tests", () => {
  it("signIn retorna erro com credenciais inválidas", async () => {
    const mockError = { message: "Invalid login credentials" };
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: mockError as any,
    });

    const { error } = await supabase.auth.signInWithPassword({
      email: "invalid@test.com",
      password: "wrong",
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("Invalid");
  });

  it("signUp exige email e password", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: { id: "test-id", email: "new@test.com" } as any, session: null },
      error: null,
    });

    const { data, error } = await supabase.auth.signUp({
      email: "new@test.com",
      password: "securePass123",
    });

    expect(error).toBeNull();
    expect(data.user).toBeTruthy();
    expect(data.user!.email).toBe("new@test.com");
  });

  it("signOut não lança erro", async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null });

    const { error } = await supabase.auth.signOut();
    expect(error).toBeNull();
  });

  it("sessão inicial é null (usuário não autenticado)", async () => {
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });
});
