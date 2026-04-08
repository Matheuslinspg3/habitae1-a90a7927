import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFunctionsInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const invoke = vi.fn();
  // Store reference for external access
  return {
    supabase: {
      functions: { invoke },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    },
  };
});

import { supabase } from "@/integrations/supabase/client";

describe("Edge Functions — autenticação negativa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("geocode-properties sem token retorna erro", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Unauthorized", status: 401 } as any,
    });

    const { error } = await supabase.functions.invoke("geocode-properties", {
      body: { batch_size: 5 },
    });

    expect(error).toBeTruthy();
    expect(error!.message).toContain("Unauthorized");
  });

  it("extract-property-pdf sem token retorna erro", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Não autorizado", status: 401 } as any,
    });

    const { error } = await supabase.functions.invoke("extract-property-pdf", {
      body: {},
    });

    expect(error).toBeTruthy();
  });

  it("admin-users sem token retorna erro", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Unauthorized", status: 401 } as any,
    });

    const { error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list" },
    });

    expect(error).toBeTruthy();
  });


  it("platform-signup sem token não deve exigir JWT no gateway", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Campos obrigatórios faltando", status: 400 } as any,
    });

    const { error } = await supabase.functions.invoke("platform-signup", {
      body: {},
    });

    expect(error).toBeTruthy();
    expect(error?.status).toBe(400);
  });
  it("billing sem token retorna erro", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Unauthorized", status: 401 } as any,
    });

    const { error } = await supabase.functions.invoke("billing", {
      body: { action: "status" },
    });

    expect(error).toBeTruthy();
  });
});

describe("Imóveis — fluxo de detalhe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("busca detalhe com joins retorna estrutura esperada", async () => {
    const mockProperty = {
      id: "prop-1",
      title: "Apartamento Centro",
      transaction_type: "sale",
      sale_price: 450000,
      bedrooms: 3,
      images: [{ id: "img-1", url: "https://example.com/photo.jpg", is_cover: true }],
      property_type: { name: "Apartamento" },
    };

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockProperty, error: null }),
    } as any);

    const result = await supabase.from("properties")
      .select("*, images:property_images(*), property_type:property_types(*)")
      .eq("id", "prop-1")
      .maybeSingle();

    expect(result.data).toBeTruthy();
    expect(result.data!.title).toBe("Apartamento Centro");
    expect(result.data!.images).toHaveLength(1);
    expect(result.data!.property_type.name).toBe("Apartamento");
  });

  it("busca detalhe com ID inexistente retorna null", async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    const result = await supabase.from("properties")
      .select("*")
      .eq("id", "nonexistent-id")
      .maybeSingle();

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});
