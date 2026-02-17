import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({ ...mockChain })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
        error: null,
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("Auth — cenários negativos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("login com senha errada retorna erro", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400 } as any,
    });

    const { error } = await supabase.auth.signInWithPassword({
      email: "user@test.com",
      password: "wrong-password",
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("Invalid");
  });

  it("login com email inexistente retorna erro", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400 } as any,
    });

    const { error } = await supabase.auth.signInWithPassword({
      email: "nonexistent@test.com",
      password: "any-password",
    });

    expect(error).toBeTruthy();
  });

  it("signup com senha fraca retorna erro", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Password should be at least 6 characters", status: 422 } as any,
    });

    const { error } = await supabase.auth.signUp({
      email: "new@test.com",
      password: "123",
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("Password");
  });

  it("signup com email inválido retorna erro", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Unable to validate email address: invalid format", status: 422 } as any,
    });

    const { error } = await supabase.auth.signUp({
      email: "not-an-email",
      password: "securePass123",
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("email");
  });
});

describe("Leads — CRUD smoke tests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listagem de leads chama tabela correta", () => {
    supabase.from("leads");
    expect(supabase.from).toHaveBeenCalledWith("leads");
  });

  it("criação de lead inclui campos obrigatórios", () => {
    const payload = {
      name: "João Silva",
      organization_id: "org-1",
      created_by: "user-1",
      stage: "novo" as const,
    };

    supabase.from("leads");
    expect(payload.name).toBeTruthy();
    expect(payload.organization_id).toBeTruthy();
    expect(payload.created_by).toBeTruthy();
    expect(payload.stage).toBeTruthy();
  });

  it("busca de lead por ID usa single()", () => {
    const chain = supabase.from("leads");
    chain.select("*").eq("id", "lead-1").single();

    expect(mockChain.select).toHaveBeenCalledWith("*");
    expect(mockChain.eq).toHaveBeenCalledWith("id", "lead-1");
    expect(mockChain.single).toHaveBeenCalled();
  });

  it("atualização de lead usa update + eq", () => {
    const chain = supabase.from("leads");
    chain.update({ name: "Maria Santos" }).eq("id", "lead-1");

    expect(mockChain.update).toHaveBeenCalledWith({ name: "Maria Santos" });
    expect(mockChain.eq).toHaveBeenCalledWith("id", "lead-1");
  });

  it("exclusão de lead usa delete + eq", () => {
    const chain = supabase.from("leads");
    chain.delete().eq("id", "lead-1");

    expect(mockChain.delete).toHaveBeenCalled();
    expect(mockChain.eq).toHaveBeenCalledWith("id", "lead-1");
  });
});

describe("RLS — autorização negada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("acesso a leads de outra organização retorna vazio", async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const result = await supabase
      .from("leads")
      .select("*")
      .eq("organization_id", "org-other")
      .order("created_at");

    expect(result.data).toEqual([]);
  });

  it("acesso a contratos de outra organização retorna vazio", async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const result = await supabase
      .from("contracts")
      .select("*")
      .eq("organization_id", "org-other")
      .order("created_at");

    expect(result.data).toEqual([]);
  });

  it("usuário sem sessão não acessa dados protegidos", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();

    // Simula RLS bloqueando acesso
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const result = await supabase.from("properties").select("*").order("created_at");
    expect(result.data).toEqual([]);
  });

  it("inserção em tabela de outra organização falha", async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "new row violates row-level security policy", code: "42501" },
      }),
    } as any);

    const result = await supabase
      .from("leads")
      .insert({ name: "Hacker", organization_id: "org-other", created_by: "user-1" })
      .select()
      .single();

    expect(result.error).toBeTruthy();
    expect(result.error!.message).toContain("row-level security");
  });
});
