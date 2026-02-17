import type { AutomationTriggerType, AutomationActionType } from "@/types/automation";

export const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  lead_created: "Novo lead criado",
  lead_stage_changed: "Lead mudou de etapa",
  contract_signed: "Contrato assinado",
  contract_expired: "Contrato expirado",
  task_due: "Tarefa prestes a vencer",
  task_overdue: "Tarefa atrasada",
  appointment_scheduled: "Visita agendada",
  appointment_completed: "Visita concluída",
  property_created: "Novo imóvel cadastrado",
  property_status_changed: "Status do imóvel alterado",
};

export const TRIGGER_DESCRIPTIONS: Record<AutomationTriggerType, string> = {
  lead_created: "Dispara quando um novo lead é criado no CRM",
  lead_stage_changed: "Dispara quando um lead muda de etapa no funil",
  contract_signed: "Dispara quando um contrato é assinado",
  contract_expired: "Dispara quando um contrato expira",
  task_due: "Dispara quando uma tarefa está prestes a vencer",
  task_overdue: "Dispara quando uma tarefa atrasa",
  appointment_scheduled: "Dispara quando uma visita é agendada",
  appointment_completed: "Dispara quando uma visita é concluída",
  property_created: "Dispara quando um novo imóvel é cadastrado",
  property_status_changed: "Dispara quando o status de um imóvel muda",
};

export const ACTION_LABELS: Record<AutomationActionType, string> = {
  create_task: "Criar tarefa",
  send_notification: "Enviar notificação",
  send_email: "Enviar e-mail",
  send_whatsapp: "Enviar WhatsApp",
  update_stage: "Mover etapa do lead",
  assign_broker: "Atribuir corretor",
  add_note: "Adicionar nota",
  create_appointment: "Criar compromisso",
  webhook: "Disparar webhook",
};

export const ACTION_DESCRIPTIONS: Record<AutomationActionType, string> = {
  create_task: "Cria uma tarefa automaticamente para o corretor responsável",
  send_notification: "Envia uma notificação interna no Habitae",
  send_email: "Envia um e-mail automaticamente (em breve)",
  send_whatsapp: "Envia mensagem no WhatsApp (em breve)",
  update_stage: "Move o lead para outra etapa do funil",
  assign_broker: "Atribui o lead para um corretor automaticamente",
  add_note: "Adiciona uma nota/observação no lead",
  create_appointment: "Cria um compromisso na agenda",
  webhook: "Envia dados para um serviço externo via webhook",
};

export const CONDITION_OPERATORS = [
  { value: "equals", label: "Igual a" },
  { value: "not_equals", label: "Diferente de" },
  { value: "greater_than", label: "Maior que" },
  { value: "less_than", label: "Menor que" },
  { value: "contains", label: "Contém" },
  { value: "is_empty", label: "Está vazio" },
  { value: "is_not_empty", label: "Não está vazio" },
];

export const DYNAMIC_VARIABLES = [
  { key: "{{nome}}", label: "Nome do lead" },
  { key: "{{email}}", label: "E-mail do lead" },
  { key: "{{telefone}}", label: "Telefone do lead" },
  { key: "{{bairro}}", label: "Bairro de interesse" },
  { key: "{{valor}}", label: "Valor estimado" },
  { key: "{{corretor}}", label: "Corretor responsável" },
  { key: "{{tipo_imovel}}", label: "Tipo de imóvel" },
  { key: "{{etapa}}", label: "Etapa do funil" },
];

export const SCORE_RULES_DEFAULT = [
  { event: "Respondeu mensagem", points: 10 },
  { event: "Marcou visita", points: 15 },
  { event: "Pediu financiamento", points: 20 },
  { event: "Visualizou imóvel", points: 5 },
  { event: "Não respondeu em 10 dias", points: -5 },
  { event: "Clicou em link", points: 8 },
];
