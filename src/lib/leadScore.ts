import { supabase } from "@/integrations/supabase/client";

/**
 * Score weight map for different lead events
 */
const SCORE_WEIGHTS: Record<string, number> = {
  // CRM stage changes
  stage_moved: 5,
  stage_advanced: 10,
  stage_win: 25,
  stage_loss: -20,

  // Interactions
  interaction_ligacao: 5,
  interaction_email: 3,
  interaction_whatsapp: 4,
  interaction_visita: 15,
  interaction_reuniao: 10,
  interaction_nota: 2,
  interaction_proposta: 20,

  // Property engagement
  property_viewed: 3,
  property_favorited: 5,
  visit_scheduled: 12,
  visit_completed: 18,

  // External signals
  ad_lead_received: 8,
  rd_conversion: 10,
  website_visit: 2,

  // Manual
  manual_boost: 10,
  manual_penalty: -10,
};

export type LeadScoreEventType = keyof typeof SCORE_WEIGHTS;

/**
 * Register a lead score event. The DB trigger will auto-recalculate the lead's score.
 */
export async function registerLeadScoreEvent(
  leadId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.organization_id) return;

  const scoreDelta = SCORE_WEIGHTS[eventType] ?? 0;

  const { error } = await supabase.from("lead_score_events").insert({
    lead_id: leadId,
    organization_id: profile.organization_id,
    event_type: eventType,
    score_delta: scoreDelta,
    metadata: metadata as any,
    created_by: user.id,
  });

  if (error) {
    console.error("Failed to register lead score event:", error);
  }
}

/**
 * Human-readable labels for event types
 */
export const EVENT_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  stage_moved: { label: "Movido de estágio", emoji: "🔄" },
  stage_advanced: { label: "Avançou de estágio", emoji: "⬆️" },
  stage_win: { label: "Fechou negócio", emoji: "🎉" },
  stage_loss: { label: "Perdido", emoji: "❌" },
  interaction_ligacao: { label: "Ligação realizada", emoji: "📞" },
  interaction_email: { label: "E-mail enviado", emoji: "📧" },
  interaction_whatsapp: { label: "WhatsApp", emoji: "💬" },
  interaction_visita: { label: "Visita realizada", emoji: "🏠" },
  interaction_reuniao: { label: "Reunião", emoji: "🤝" },
  interaction_nota: { label: "Nota adicionada", emoji: "📝" },
  interaction_proposta: { label: "Proposta enviada", emoji: "📋" },
  property_viewed: { label: "Visualizou imóvel", emoji: "👁" },
  property_favorited: { label: "Favoritou imóvel", emoji: "⭐" },
  visit_scheduled: { label: "Visita agendada", emoji: "📅" },
  visit_completed: { label: "Visita concluída", emoji: "✅" },
  ad_lead_received: { label: "Lead de anúncio", emoji: "📢" },
  rd_conversion: { label: "Conversão RD", emoji: "🎯" },
  website_visit: { label: "Visitou site", emoji: "🌐" },
  manual_boost: { label: "Boost manual", emoji: "🚀" },
  manual_penalty: { label: "Penalidade manual", emoji: "⚠️" },
};
