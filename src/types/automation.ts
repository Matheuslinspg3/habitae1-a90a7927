// Types for future automation features in Habitae
// This file prepares the architecture for workflow automation

import type { Lead } from '@/hooks/useLeads';
import type { Task } from '@/hooks/useTasks';

// ============= TRIGGER TYPES =============

export type AutomationTriggerType =
  | 'lead_created'
  | 'lead_stage_changed'
  | 'contract_signed'
  | 'contract_expired'
  | 'task_due'
  | 'task_overdue'
  | 'appointment_scheduled'
  | 'appointment_completed'
  | 'property_created'
  | 'property_status_changed';

export interface AutomationTrigger {
  type: AutomationTriggerType;
  conditions?: Record<string, unknown>;
}

// ============= ACTION TYPES =============

export type AutomationActionType =
  | 'create_task'
  | 'send_notification'
  | 'send_email'
  | 'send_whatsapp'
  | 'update_stage'
  | 'assign_broker'
  | 'add_note'
  | 'create_appointment'
  | 'webhook';

export interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
  delay?: number; // Delay in minutes before executing
}

// ============= AUTOMATION RULE =============

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============= INTEGRATION HOOKS =============

export interface IntegrationHook {
  onLeadCreated?: (lead: Lead) => void;
  onLeadStageChanged?: (lead: Lead, oldStage: string, newStage: string) => void;
  onContractSigned?: (contractId: string) => void;
  onTaskDue?: (task: Task) => void;
  onTaskCompleted?: (task: Task) => void;
  onAppointmentScheduled?: (appointmentId: string) => void;
}

// ============= PRESET AUTOMATIONS =============

export const PRESET_AUTOMATIONS: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Follow-up automático para novos leads',
    description: 'Cria uma tarefa de follow-up quando um novo lead é cadastrado',
    trigger: {
      type: 'lead_created',
    },
    actions: [
      {
        type: 'create_task',
        config: {
          title: 'Follow-up: {lead.name}',
          priority: 'alta',
          due_in_hours: 24,
        },
      },
    ],
    enabled: true,
  },
  {
    name: 'Alerta de tarefa atrasada',
    description: 'Envia notificação quando uma tarefa está atrasada',
    trigger: {
      type: 'task_overdue',
    },
    actions: [
      {
        type: 'send_notification',
        config: {
          title: 'Tarefa atrasada',
          message: 'A tarefa "{task.title}" está atrasada',
        },
      },
    ],
    enabled: true,
  },
  {
    name: 'Atualização de estágio após visita',
    description: 'Move o lead para "Proposta" após compromisso de visita ser concluído',
    trigger: {
      type: 'appointment_completed',
      conditions: {
        appointment_type: 'visita',
      },
    },
    actions: [
      {
        type: 'update_stage',
        config: {
          new_stage: 'proposta',
        },
      },
      {
        type: 'create_task',
        config: {
          title: 'Enviar proposta: {lead.name}',
          priority: 'alta',
          due_in_hours: 48,
        },
      },
    ],
    enabled: false,
  },
];

// ============= AUTOMATION SERVICE INTERFACE =============

// This interface will be implemented when automation is fully developed
export interface AutomationService {
  trigger: (type: AutomationTriggerType, data: Record<string, unknown>) => void;
  registerRule: (rule: AutomationRule) => void;
  unregisterRule: (ruleId: string) => void;
  getRules: () => AutomationRule[];
  getPresets: () => typeof PRESET_AUTOMATIONS;
}

// ============= PLACEHOLDER SERVICE =============

// Placeholder implementation for future development
export const automationService: AutomationService = {
  trigger: (type, data) => {
    // Will be implemented when automation feature is developed
    console.log('[Automation] Trigger:', type, data);
  },
  registerRule: (rule) => {
    console.log('[Automation] Rule registered:', rule.name);
  },
  unregisterRule: (ruleId) => {
    console.log('[Automation] Rule unregistered:', ruleId);
  },
  getRules: () => [],
  getPresets: () => PRESET_AUTOMATIONS,
};
