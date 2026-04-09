import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { DeveloperRoute } from "@/components/developer/DeveloperRoute";
import { AdminRoute } from "@/components/admin/AdminRoute";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRoles: vi.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseUserRoles = vi.mocked(useUserRoles);

function renderDeveloperRoute(requiredRole?: "developer" | "leader") {
  render(
    <MemoryRouter initialEntries={["/developer"]}>
      <Routes>
        <Route
          path="/developer"
          element={
            <DeveloperRoute requiredRole={requiredRole}>
              <div>Área do Desenvolvedor</div>
            </DeveloperRoute>
          }
        />
        <Route path="/acesso-negado" element={<div>Acesso Negado</div>} />
        <Route path="/auth" element={<div>Auth</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAdminRoute() {
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>Área de Auditoria</div>
            </AdminRoute>
          }
        />
        <Route path="/acesso-negado" element={<div>Acesso Negado</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Tenant route guards", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: { id: "user-1" } as any,
      loading: false,
      session: null,
      profile: null,
      organizationType: null,
      trialInfo: null,
      signUp: vi.fn() as any,
      signIn: vi.fn() as any,
      signOut: vi.fn() as any,
      refreshProfile: vi.fn() as any,
    });
  });

  it("permite DeveloperRoute quando role elevada está no tenant corrente", () => {
    mockedUseUserRoles.mockReturnValue({
      roles: ["developer"],
      activeOrganizationId: "org-a",
      isLoading: false,
      hasRole: vi.fn((role) => role === "developer") as any,
      isDeveloper: true,
      isLeader: false,
      isAdmin: false,
      isSubAdmin: false,
      isAdminOrAbove: true,
      isDeveloperOrLeader: true,
    });

    renderDeveloperRoute();
    expect(screen.getByText("Área do Desenvolvedor")).toBeInTheDocument();
  });

  it("bloqueia DeveloperRoute quando usuário é developer na org A, mas contexto ativo é org B", () => {
    mockedUseUserRoles.mockReturnValue({
      roles: [],
      activeOrganizationId: "org-b",
      isLoading: false,
      hasRole: vi.fn(() => false) as any,
      isDeveloper: false,
      isLeader: false,
      isAdmin: false,
      isSubAdmin: false,
      isAdminOrAbove: false,
      isDeveloperOrLeader: false,
    });

    renderDeveloperRoute();
    expect(screen.getByText("Acesso Negado")).toBeInTheDocument();
  });

  it("bloqueia AdminRoute quando role elevada existe em outro tenant", () => {
    mockedUseUserRoles.mockReturnValue({
      roles: [],
      activeOrganizationId: "org-b",
      isLoading: false,
      hasRole: vi.fn(() => false) as any,
      isDeveloper: false,
      isLeader: false,
      isAdmin: false,
      isSubAdmin: false,
      isAdminOrAbove: false,
      isDeveloperOrLeader: false,
    });

    renderAdminRoute();
    expect(screen.getByText("Acesso Negado")).toBeInTheDocument();
  });
});
