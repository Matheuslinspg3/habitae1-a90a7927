import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";

interface AuditEvent {
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  action_category?: string;
  module?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status?: string;
  risk_level?: string;
  target_user_id?: string;
  parent_entity_type?: string;
  parent_entity_id?: string;
}

export function useAuditLog() {
  const { user, profile } = useAuth();
  const { roles } = useUserRoles();
  const location = useLocation();

  const log = useCallback(
    async (event: AuditEvent) => {
      if (!user?.id || !profile?.organization_id) return;

      try {
        await supabase.rpc("insert_audit_event" as any, {
          p_organization_id: profile.organization_id,
          p_user_id: user.id,
          p_acting_role: role || "unknown",
          p_entity_type: event.entity_type,
          p_entity_id: event.entity_id || null,
          p_entity_name: event.entity_name || null,
          p_action: event.action,
          p_action_category: event.action_category || "read",
          p_module: event.module || null,
          p_description: event.description || null,
          p_source: "web",
          p_status: event.status || "success",
          p_risk_level: event.risk_level || "low",
          p_target_user_id: event.target_user_id || null,
          p_parent_entity_type: event.parent_entity_type || null,
          p_parent_entity_id: event.parent_entity_id || null,
          p_route: location.pathname,
          p_metadata: event.metadata || {},
        });
      } catch {
        // Audit logging should never break the user flow
      }
    },
    [user?.id, profile?.organization_id, role, location.pathname]
  );

  const logView = useCallback(
    (entityType: string, entityId: string, entityName?: string, module?: string) => {
      log({
        action: `${entityType}.viewed`,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        action_category: "read",
        module,
        description: entityName
          ? `${entityType === "lead" ? "Lead" : entityType === "property" ? "Imóvel" : entityType === "contract" ? "Contrato" : entityType} "${entityName}" visualizado`
          : undefined,
      });
    },
    [log]
  );

  const logPermissionDenied = useCallback(
    (action: string, module?: string) => {
      log({
        action: "permission.denied",
        entity_type: "system",
        action_category: "security",
        module,
        description: `Acesso negado: ${action}`,
        status: "denied",
        risk_level: "medium",
      });
    },
    [log]
  );

  const logExport = useCallback(
    (entityType: string, format: string, count?: number, module?: string) => {
      log({
        action: "export.generated",
        entity_type: entityType,
        action_category: "read",
        module,
        description: `Exportação ${format.toUpperCase()} de ${count || "?"} ${entityType}`,
        risk_level: "medium",
        metadata: { format, count },
      });
    },
    [log]
  );

  return { log, logView, logPermissionDenied, logExport };
}
