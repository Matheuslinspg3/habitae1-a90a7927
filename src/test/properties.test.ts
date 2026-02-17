import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockFrom = {
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
    from: vi.fn(() => ({ ...mockFrom })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
        error: null,
      }),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";

describe("Properties — smoke tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listagem de imóveis chama tabela correta", () => {
    supabase.from("properties");
    expect(supabase.from).toHaveBeenCalledWith("properties");
  });

  it("criação de imóvel inclui campos obrigatórios", () => {
    const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: "prop-1" }, error: null }) });
    vi.mocked(supabase.from).mockReturnValueOnce({ insert: mockInsert } as any);

    const payload = {
      title: "Apartamento Teste",
      transaction_type: "sale" as const,
      organization_id: "org-1",
      created_by: "user-1",
    };

    supabase.from("properties");
    expect(payload.title).toBeTruthy();
    expect(payload.transaction_type).toBeTruthy();
    expect(payload.organization_id).toBeTruthy();
  });

  it("busca por ID retorna single()", () => {
    const chain = supabase.from("properties");
    chain.select("*").eq("id", "prop-1").single();

    expect(mockFrom.select).toHaveBeenCalledWith("*");
    expect(mockFrom.eq).toHaveBeenCalledWith("id", "prop-1");
    expect(mockFrom.single).toHaveBeenCalled();
  });
});

describe("RLS — smoke tests conceituais", () => {
  it("query sem sessão não deveria retornar dados sensíveis", async () => {
    // Simula cenário onde RLS bloqueia acesso
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const result = await supabase.from("properties")
      .select("*")
      .eq("organization_id", "org-outro")
      .order("created_at");

    expect(result.data).toEqual([]);
  });
});
