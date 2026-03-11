# Estrutura de Dados — Habitae ERP Imobiliário (Lovable Cloud / Supabase)

## Tabelas Principais

- **organizations**: multi-tenant (id, name, type, slug, phone, email, invite_code)
- **profiles**: usuários (user_id, organization_id, full_name, phone, avatar_url)
- **user_roles**: RBAC (user_id, role: admin|sub_admin|corretor|assistente|developer|leader)
- **properties**: imóveis (id, organization_id, title, property_code, status, transaction_type, sale_price, rent_price, bedrooms, bathrooms, area_total, address_city, address_neighborhood, address_state, property_type_id, created_by)
- **property_images**: fotos (property_id, url, is_cover, display_order, r2_key_full, storage_provider)
- **property_media**: mídia Cloudinary/R2 (property_id, original_url, stored_url, file_size_bytes)
- **property_types**: tipos de imóvel (id, name, organization_id)
- **leads**: CRM (id, organization_id, name, email, phone, broker_id, lead_stage_id, lead_type_id, temperature, estimated_value, source, is_active, position)
- **lead_stages**: etapas do funil Kanban (id, name, color, position, is_win, is_loss)
- **lead_types**: tipos de lead (id, name, color)
- **lead_interactions**: histórico (lead_id, type: ligacao|email|visita|whatsapp|reuniao|nota, description, created_by)
- **contracts**: contratos (id, code, type: venda|aluguel, value, status, property_id, lead_id, broker_id, commission_percentage)
- **commissions**: comissões (contract_id, broker_id, amount, percentage, paid)
- **transactions**: financeiro (type: receita|despesa, amount, date, category_id, contract_id, paid)
- **transaction_categories**: categorias financeiras (id, name)
- **invoices**: faturas (amount, due_date, status: pendente|paga|cancelada, contract_id, lead_id)
- **appointments**: agenda (title, start_time, end_time, lead_id, property_id, assigned_to)
- **tasks**: tarefas (title, organization_id, assigned_to, completed)
- **notifications**: notificações internas (user_id, type, title, message, entity_id, entity_type, read)
- **activity_log**: log de atividades (action_type, entity_type, entity_id, user_id)
- **marketplace_properties**: vitrine pública entre imobiliárias (espelho de properties com images[], amenities[], commission_percentage)
- **consumer_favorites**: favoritos (user_id, property_id)
- **subscriptions**: assinaturas (organization_id, plan_id, status: active|trial, current_period_end, trial_end)
- **subscription_plans**: catálogo de planos (slug, marketplace_access, partnership_access)

## Tabelas de Integração

- **ad_accounts, ad_entities, ad_insights_daily, ad_leads, ad_settings**: Meta Ads
- **imobzi_settings, import_runs, import_run_items**: Importação Imobzi
- **crm_import_logs**: Importação CSV/API

## Tabelas de Suporte

- **support_tickets, support_messages**: Suporte
- **audit_logs**: Auditoria
- **admin_allowlist**: Super-admins por email
- **push_subscriptions**: Push notifications (OneSignal)
- **billing_payments, billing_webhook_logs**: Billing

## Relacionamentos Principais

- profiles.organization_id → organizations.id (vínculo usuário-org)
- properties.organization_id → organizations.id
- leads.broker_id → profiles.user_id (corretor responsável)
- leads.lead_stage_id → lead_stages.id (etapa do funil)
- contracts.property_id → properties.id
- contracts.lead_id → leads.id
- commissions.contract_id → contracts.id
- transactions.category_id → transaction_categories.id
- invoices.contract_id → contracts.id

## Segurança

- Multi-tenant: tudo filtrado por organization_id via RLS
- RBAC via tabela user_roles com funções SQL: has_role(), is_org_admin(), is_org_manager_or_above(), is_system_admin()
- Hierarquia: developer > admin > sub_admin > leader > corretor > assistente (somente leitura)
- RLS em todas as tabelas com Security Definer functions para evitar recursão
- PII (email/telefone em ad_leads) restrito a managers+

## Edge Functions (Backend Serverless)

- billing, billing-webhook: Pagamentos
- imobzi-import, imobzi-list, imobzi-process: Integração Imobzi
- meta-sync-leads, meta-sync-entities, meta-oauth-callback: Meta Ads
- rd-station-*: RD Station CRM
- geocode-properties: Geocodificação
- extract-property-pdf: Extração de PDF
- send-push, notifications-register-device: Push notifications
- portal-xml-feed: Feed XML para portais
- cloudinary-sign, r2-upload, r2-presign: Storage
- send-invite-email, accept-invite: Convites
- platform-signup: Cadastro de novas organizações
- admin-users, admin-subscriptions, admin-audit-metrics: Administração
