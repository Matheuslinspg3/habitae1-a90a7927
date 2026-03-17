# Checklist de Migração — Habitae (Lovable Cloud → Supabase Próprio)

## Fase 1: Preparação (antes de mexer em qualquer coisa)

- [ ] **1.1** Criar conta/projeto no [Supabase](https://supabase.com/dashboard) (região: South America East 1 - São Paulo)
- [ ] **1.2** Anotar as credenciais do novo projeto:
  - `SUPABASE_URL` (ex: `https://xyzxyz.supabase.co`)
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] **1.3** Garantir que o projeto atual no Lovable está conectado ao GitHub
  - Settings → GitHub → verificar repo conectado
- [ ] **1.4** Clonar o repositório GitHub localmente:
  ```bash
  git clone https://github.com/SEU_USUARIO/SEU_REPO.git habitae-backup
  ```

---

## Fase 2: Exportação do Banco de Dados

### 2.1 — Exportar Schema + Dados
- [ ] Acessar `/manutencao` no app (logado como developer/admin)
- [ ] Clicar em **"Exportar Banco de Dados"** → Isso chama a edge function `export-database`
- [ ] O JSON retornado contém:
  - `schema_ddl` → SQL completo (enums, tabelas, funções, triggers, policies, indexes)
  - `tables` → Objeto com CSV de cada tabela
  - `_auth_users` → Dados dos usuários (sem senhas)
  - `errors` → Tabelas que falharam (verificar)

### 2.2 — Salvar os arquivos
- [ ] Salvar o `schema_ddl` como `migration_schema.sql`
- [ ] Salvar cada CSV de tabela individualmente (ou manter o JSON completo)
- [ ] Salvar o CSV de `_auth_users` separadamente

---

## Fase 3: Importação no Supabase Novo

### 3.1 — Schema (estrutura)
- [ ] No Supabase Dashboard → **SQL Editor**
- [ ] Executar o conteúdo de `migration_schema.sql`
  - ⚠️ Se der erro, executar em partes: Enums → Tabelas → Functions → Triggers → Policies → Indexes
- [ ] Verificar que todas as tabelas foram criadas (Table Editor)

### 3.2 — Dados
- [ ] Para cada tabela com dados, importar via SQL Editor ou CSV Import:
  - Tabelas sem FK primeiro: `organizations`, `subscription_plans`, `property_types`, `lead_stages`, `lead_types`, `transaction_categories`
  - Depois tabelas com FK: `profiles`, `properties`, `leads`, etc.
  - Por último: tabelas de junção e logs
- [ ] Ordem sugerida de importação:
  ```
  1. subscription_plans
  2. organizations
  3. profiles
  4. user_roles
  5. admin_allowlist
  6. app_runtime_config
  7. property_types, property_type_codes, city_codes, zone_codes
  8. lead_stages, lead_types
  9. owners, owner_aliases
  10. properties
  11. property_images, property_media, property_owners
  12. property_share_links, property_landing_content, property_landing_overrides
  13. property_partnerships, property_visibility
  14. leads
  15. lead_interactions
  16. contracts, contract_documents
  17. commissions
  18. invoices
  19. transactions
  20. tasks, appointments
  21. notifications
  22. (restante das tabelas)
  ```

### 3.3 — Usuários (auth.users)
- [ ] **IMPORTANTE**: Não é possível importar senhas dos usuários
- [ ] Opções:
  - **Opção A** (recomendada): Criar usuários via Admin API com senha temporária, forçar reset no primeiro login
  - **Opção B**: Pedir que todos os usuários façam "Esqueci minha senha"
- [ ] Script para criar usuários (executar via edge function ou script local):
  ```typescript
  // Para cada usuário do CSV _auth_users:
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: 'SenhaTempHabitae2024!',
    email_confirm: true,
    user_metadata: user.user_metadata,
    app_metadata: user.app_metadata,
  });
  // IMPORTANTE: o ID gerado será DIFERENTE do original!
  // Será necessário atualizar todas as referências de user_id nas tabelas
  ```
- [ ] ⚠️ **IDs dos usuários vão mudar!** Criar mapeamento old_id → new_id e atualizar:
  - `profiles.user_id`
  - `user_roles.user_id`
  - `leads.broker_id`, `leads.created_by`
  - `contracts.broker_id`, `contracts.created_by`
  - `properties.created_by`
  - `appointments.assigned_to`, `appointments.created_by`
  - `tasks.assigned_to`, `tasks.created_by`
  - `notifications.user_id`
  - Todas as demais colunas que referenciam user_id

### 3.4 — Storage Buckets
- [ ] Recriar os buckets necessários no novo Supabase (Storage → New Bucket)
- [ ] Recriar as policies de storage
- [ ] Migrar arquivos (se houver) — ou manter URLs externas (Cloudinary/R2)

---

## Fase 4: Configuração do Novo Projeto Lovable

### 4.1 — Criar projeto novo
- [ ] No Lovable, criar um **novo projeto vazio**
- [ ] Conectar ao seu Supabase: Settings → Connectors → Supabase → Conectar
  - Colar `SUPABASE_URL` e `SUPABASE_ANON_KEY`

### 4.2 — Conectar ao GitHub
- [ ] Settings → GitHub → Connect → Criar **novo repositório** (ex: `habitae-v2`)
- [ ] Clonar este novo repo localmente:
  ```bash
  git clone https://github.com/SEU_USUARIO/habitae-v2.git
  ```

### 4.3 — Copiar o código
- [ ] Copiar **todo o conteúdo** do repo antigo (`habitae-backup`) para o novo (`habitae-v2`)
- [ ] **NÃO copiar** estes arquivos/pastas:
  - `.env` (será gerado pelo Lovable)
  - `supabase/config.toml` (será gerado pelo Lovable)
  - `node_modules/`
  - `.git/`
- [ ] Atualizar referências hardcoded ao projeto antigo (se houver):
  - Buscar pelo project ID antigo: `aiflfkkjitvsyszwdfga`
  - Buscar pela URL antiga: `aiflfkkjitvsyszwdfga.supabase.co`
  - Substituir pela URL/ID do novo projeto
- [ ] Commit e push:
  ```bash
  cd habitae-v2
  git add .
  git commit -m "migração: código do Habitae"
  git push origin main
  ```
- [ ] Aguardar o Lovable sincronizar (alguns segundos)

---

## Fase 5: Secrets e Configurações

### 5.1 — Reconfigurar Secrets no novo Supabase
- [ ] Supabase Dashboard → Settings → Edge Functions → Secrets
- [ ] Adicionar cada secret necessário:
  - `ONESIGNAL_APP_ID`
  - `ONESIGNAL_REST_API_KEY`
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_ENDPOINT`
  - `R2_PUBLIC_URL`
  - `ASAAS_API_KEY` (billing)
  - `META_APP_ID`, `META_APP_SECRET` (Meta Ads)
  - `RD_STATION_CLIENT_ID`, `RD_STATION_CLIENT_SECRET`
  - `GENERATE_ART_WEBHOOK`
  - `GENERATE_VIDEO_WEBHOOK`
  - (verificar se há outros)

### 5.2 — Auth Settings
- [ ] Supabase Dashboard → Authentication → Settings
- [ ] Ativar **Leaked Password Protection**
- [ ] Configurar Site URL para o domínio correto
- [ ] Configurar Redirect URLs

---

## Fase 6: Validação

- [ ] **6.1** Login funciona (testar com um usuário)
- [ ] **6.2** Listagem de imóveis carrega
- [ ] **6.3** CRM/Leads funciona
- [ ] **6.4** Upload de fotos funciona
- [ ] **6.5** Notificações push funcionam
- [ ] **6.6** Edge functions respondem (testar 2-3 principais)
- [ ] **6.7** Importação Imobzi funciona (se aplicável)
- [ ] **6.8** Billing/pagamentos funciona

---

## Fase 7: Go Live

- [ ] **7.1** Ativar modo manutenção no projeto ANTIGO
- [ ] **7.2** Fazer uma última exportação de dados (delta desde a Fase 2)
- [ ] **7.3** Importar delta no novo Supabase
- [ ] **7.4** Atualizar DNS/domínio para apontar ao novo projeto
- [ ] **7.5** Publicar o projeto novo no Lovable
- [ ] **7.6** Comunicar usuários sobre reset de senha (se Opção A)
- [ ] **7.7** Monitorar logs por 48h

---

## ⚠️ Riscos e Cuidados

| Risco | Mitigação |
|-------|-----------|
| IDs de usuários mudam | Mapeamento old→new + script de atualização em massa |
| Dados perdidos entre export e go-live | Modo manutenção + exportação delta |
| Secrets esquecidos | Checklist acima + testar cada integração |
| Edge functions com URL hardcoded | Buscar e substituir project ID antigo |
| Storage/arquivos não migrados | Manter URLs externas (Cloudinary/R2) |

---

## Estimativa de Tempo

| Fase | Tempo estimado |
|------|---------------|
| Preparação | 30 min |
| Exportação | 15 min |
| Importação Schema | 1-2h (pode ter ajustes) |
| Importação Dados | 2-3h |
| Migração Usuários | 1-2h |
| Setup Lovable + GitHub | 30 min |
| Secrets | 30 min |
| Validação | 2-3h |
| Go Live | 1h |
| **Total** | **~8-12h** |
