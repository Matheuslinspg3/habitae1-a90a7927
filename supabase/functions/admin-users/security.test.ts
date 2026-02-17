import { describe, expect, it } from "vitest";
import { assertTargetUserInScope, assertTenantScope, isPlatformAuthorized } from "./security";

describe("admin-users security", () => {
  it("nega usuário developer fora de escopo de plataforma", () => {
    const authorized = isPlatformAuthorized({
      userId: "dev-user",
      userRoles: [{ role: "developer", organization_id: "org-a" }],
      platformAdminUserIds: new Set<string>(),
      platformAdminRole: "platform_admin",
      platformControllerOrgId: "controller-org",
    });

    expect(authorized).toBe(false);
  });

  it("exige organization_id para escopo de tenant", () => {
    expect(() => assertTenantScope("")).toThrow("Forbidden: organization_id scope required");
  });

  it("nega operação quando alvo está fora do tenant informado", () => {
    expect(() => {
      assertTargetUserInScope({ requestedOrganizationId: "org-a", targetOrganizationId: "org-b" });
    }).toThrow("Forbidden: user outside allowed tenant scope");
  });
});
