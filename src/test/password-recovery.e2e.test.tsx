import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

const resetPasswordForEmail = vi.fn();
const setSession = vi.fn();
const getSession = vi.fn();
const updateUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail,
      setSession,
      getSession,
      updateUser,
    },
  },
}));

describe("Recuperação de senha — E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
    window.location.hash = "";
  });

  it("executa fluxo completo: solicita link e redefine senha", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    setSession.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({ data: { session: { user: { id: "1" } } } });
    updateUser.mockResolvedValue({ error: null });

    const { rerender } = render(
      <MemoryRouter initialEntries={["/esqueci-a-senha"]}>
        <Routes>
          <Route path="/esqueci-a-senha" element={<ForgotPassword />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "user@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar link de redefinição/i }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "user@test.com",
        expect.objectContaining({ redirectTo: expect.stringContaining("/redefinir-senha") })
      );
    });

    expect(screen.getByText(/enviamos um link de redefinição para/i)).toBeInTheDocument();

    window.history.replaceState(
      null,
      "",
      "/redefinir-senha#access_token=test-access&refresh_token=test-refresh&type=recovery"
    );

    rerender(
      <MemoryRouter initialEntries={["/redefinir-senha"]}>
        <Routes>
          <Route path="/redefinir-senha" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(setSession).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "novaSenha123" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "novaSenha123" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar nova senha/i }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: "novaSenha123" });
    });

    expect(screen.getByText(/senha atualizada com sucesso/i)).toBeInTheDocument();
  });

  it("exibe mensagem clara para token inválido e permite reenviar link", async () => {
    setSession.mockResolvedValue({ error: { message: "invalid or expired token" } });
    resetPasswordForEmail.mockResolvedValue({ error: null });

    window.history.replaceState(
      null,
      "",
      "/redefinir-senha#access_token=bad&refresh_token=bad&type=recovery"
    );

    render(
      <MemoryRouter initialEntries={["/redefinir-senha"]}>
        <Routes>
          <Route path="/redefinir-senha" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/expirou ou é inválido/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "retry@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /reenviar link de redefinição/i }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "retry@test.com",
        expect.objectContaining({ redirectTo: expect.stringContaining("/redefinir-senha") })
      );
    });
  });
});
