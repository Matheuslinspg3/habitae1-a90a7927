export type UserRoleRow = {
  role: string;
  organization_id?: string | null;
};

export function isPlatformAuthorized(params: {
  userId: string;
  userRoles: UserRoleRow[];
  platformAdminUserIds: Set<string>;
  platformAdminRole: string;
  platformControllerOrgId: string;
}) {
  const { userId, userRoles, platformAdminUserIds, platformAdminRole, platformControllerOrgId } = params;

  if (platformAdminUserIds.has(userId)) {
    return true;
  }

  return userRoles.some((roleRow) => {
    return roleRow.role === platformAdminRole && roleRow.organization_id === platformControllerOrgId;
  });
}

export function assertTenantScope(organizationId?: string) {
  if (!organizationId) {
    throw new Error("Forbidden: organization_id scope required");
  }
}

export function assertTargetUserInScope(params: {
  requestedOrganizationId: string;
  targetOrganizationId?: string | null;
}) {
  const { requestedOrganizationId, targetOrganizationId } = params;
  if (!targetOrganizationId || targetOrganizationId !== requestedOrganizationId) {
    throw new Error("Forbidden: user outside allowed tenant scope");
  }
}
