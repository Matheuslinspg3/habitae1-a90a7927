# AUTH AND RLS ANALYSIS — Habitae1

**Data**: 2026-03-18 | **Foco**: Autenticação, Multi-Tenant, Row Level Security

---

## 1. COMO A AUTENTICAÇÃO FUNCIONA HOJE

### Diagrama do Fluxo Completo

```
┌─────────────┐     signInWithPassword()     ┌──────────────────┐
│   Frontend  │ ────────────────────────────► │  Supabase Auth   │
│  (React)    │ ◄─────────────────────────── │  (auth.users)    │
└─────────────┘    JWT + refresh_token        └──────────────────┘
       │
       │ armazena em localStorage
       │ sb-aiflfkkjitvsyszwdfga-auth-token
       ▼
┌─────────────────────────────────────────┐
│         onAuthStateChange()             │
│  event: SIGNED_IN / TOKEN_REFRESHED     │
│  event: SIGNED_OUT                      │
└─────────────────────────────────────────┘
       │
       │ getSession() → user + session
       ▼
┌──────────────────────────────────────────────────┐
│              AuthContext.tsx                      │
│                                                  │
│  1. Busca profiles WHERE user_id = auth.uid()   │
│  2. Busca organizations WHERE id = profile.org  │
│  3. Calcula trial_info (is_trial_expired)        │
│  4. Set: user, session, profile, orgType         │
│  5. initOneSignal(userId) → push notifications  │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│              ProtectedRoute.tsx                   │
│                                                  │
│  if (!user)         → redirect /auth             │
│  if (trial_expired) → TrialExpiredScreen         │
│  if (!isAdmin)      → redirect /acesso-negado    │
└──────────────────────────────────────────────────┘
       │
       ▼
  [ App funcionando com user + profile + orgId ]
```

### Persistência do JWT

| Aspecto | Valor |
|---------|-------|
| Storage | `localStorage` |
| Chave | `sb-aiflfkkjitvsyszwdfga-auth-token` |
| Conteúdo | `{ access_token, refresh_token, expires_at, user }` |
| Auto-refresh | 60 segundos antes da expiração |
| Expiração do access token | ~1 hora (padrão Supabase) |
| Expiração do refresh token | 30 dias (padrão Supabase) |

### Eventos do `onAuthStateChange`

| Evento | O que acontece |
|--------|---------------|
| `SIGNED_IN` | Carrega profile + org + inicia OneSignal |
| `SIGNED_OUT` | Limpa user, session, profile; desregistra OneSignal |
| `TOKEN_REFRESHED` | Atualiza session em estado, sem recarregar profile |
| `USER_UPDATED` | Re-fetcha profile para dados atualizados |

---

## 2. COMO `organization_id` PARTICIPA DA SEGURANÇA

### Cadeia de Isolamento Multi-Tenant

```
auth.uid()
    │
    ▼
profiles.user_id = auth.uid()
    │
    ├── profiles.organization_id  ← âncora de isolamento
    │
    ▼
get_user_organization_id()  [SECURITY DEFINER]
    │
    ├── is_member_of_org(target_org_id)  [verifica mesma org]
    │
    └── TODAS as RLS policies usam esta função
```

### Funções SECURITY DEFINER que implementam o isolamento

```sql
-- Retorna org do usuário atual
CREATE FUNCTION public.get_user_organization_id()
RETURNS UUID SECURITY DEFINER AS $$
  SELECT organization_id FROM public.profiles
  WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Verifica se usuário é membro de uma org específica
CREATE FUNCTION public.is_member_of_org(_org_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND organization_id = _org_id
  );
$$;

-- Verifica role admin dentro da org do usuário
CREATE FUNCTION public.is_org_admin(_user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'sub_admin', 'developer', 'leader')
      AND ur.organization_id = p.organization_id  -- ← contexto da org
  );
$$;

-- ⚠️ ATENÇÃO: is_org_manager_or_above NÃO tem filtro de org_id
CREATE FUNCTION public.is_org_manager_or_above(_user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'sub_admin', 'leader', 'developer')
    -- ← SEM filtro de organization_id! Depende do contexto externo.
  );
$$;
```

### Onde `organization_id` é usado no frontend

Cada hook de dados explicitamente filtra pela org do usuário:

```typescript
// Padrão adotado em TODOS os hooks (useProperties, useLeads, useContracts, etc.)
const { profile } = useAuth();

const { data } = useQuery({
  queryKey: ['resource', profile?.organization_id],
  queryFn: async () => {
    if (!profile?.organization_id) return [];
    const { data } = await supabase
      .from('table')
      .select('*')
      .eq('organization_id', profile.organization_id);  // ← filtro explícito
    return data;
  },
  enabled: !!profile?.organization_id,  // ← guard
});
```

**Resultado**: Dupla proteção — frontend filtra + RLS aplica no banco.

---

## 3. COMO A RLS DEPENDE DA AUTH ATUAL

### Dependência Direta de `auth.uid()`

Todas as RLS policies dependem de `auth.uid()` indiretamente via:
- `get_user_organization_id()` → chama `auth.uid()`
- `is_member_of_org()` → chama `auth.uid()`
- `is_org_admin()` → recebe `auth.uid()` como argumento

Isso significa que **a RLS só funciona com JWT válido no contexto da query**.

### Políticas RLS por Tabela (Completo)

#### `profiles`
```sql
SELECT: organization_id = get_user_organization_id() OR user_id = auth.uid()
INSERT: user_id = auth.uid()
UPDATE: user_id = auth.uid()
-- Sem DELETE (registros permanentes)
```

#### `organizations`
```sql
SELECT: is_member_of_org(id)
UPDATE: is_member_of_org(id) AND is_org_admin(auth.uid())
INSERT: auth.uid() IS NOT NULL  -- durante signup
```

#### `properties` / `leads` / `contracts` / `transactions` / `appointments` / `tasks`
```sql
SELECT: is_member_of_org(organization_id)
INSERT: organization_id = get_user_organization_id()
UPDATE: is_member_of_org(organization_id)
DELETE: is_member_of_org(organization_id) AND is_org_admin(auth.uid())
```

#### `user_roles`
```sql
SELECT: organization_id = get_user_organization_id()
ALL mutations: organization_id = get_user_organization_id() AND is_org_admin(auth.uid())
```

#### `subscriptions`
```sql
SELECT: organization_id = get_user_organization_id()
-- Escritas apenas via service role (edge functions)
```

#### `marketplace_properties`
```sql
SELECT: has_active_subscription(get_user_organization_id())
        AND can_access_marketplace(get_user_organization_id())
-- Acesso negado a orgs sem plano com marketplace_access = true
```

#### `ad_leads`
```sql
SELECT: organization_id = get_user_organization_id()
        AND get_user_organization_id() IS NOT NULL
        AND is_org_manager_or_above(auth.uid())
-- Apenas managers podem ver leads de anúncio
```

#### `organization_invites`
```sql
-- ATENÇÃO: leitura pública para anon
SELECT (anon): status = 'pending' AND expires_at > now()
INSERT (authenticated): organization_id = get_user_organization_id()
UPDATE (authenticated): organization_id = get_user_organization_id()
```

#### `scrape_cache`
```sql
SELECT: true  -- qualquer autenticado
INSERT: true  -- qualquer autenticado
-- Cache compartilhado globalmente (por design)
```

---

## 4. RISCOS DE QUEBRAR O ISOLAMENTO MULTI-TENANT

### RISCO CRÍTICO #1: Storage Buckets sem `organization_id`

**Tabela afetada**: `storage.objects` (bucket `property-images`, `lead-documents`)

```sql
-- ATUAL (INSEGURO):
CREATE POLICY "Users can delete their property images"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-images' AND auth.uid() IS NOT NULL);
-- Qualquer usuário autenticado pode deletar imagens de qualquer org

-- DEVERIA SER:
USING (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
);
```

**Impacto na migração**: Se a migração mantiver essas políticas, o isolamento entre orgs fica comprometido para arquivos.

### RISCO ALTO #2: `is_org_manager_or_above` sem contexto de org

```sql
-- ATUAL: verifica role sem especificar a qual org pertence
SELECT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = _user_id
    AND ur.role IN ('admin', 'sub_admin', 'leader', 'developer')
  -- ← SEM organization_id filter
);
```

**Cenário de ataque**: Usuário com role `developer` em Org A poderia passar na verificação quando contexto de Org B é avaliado.

**Mitigação atual**: A função é sempre chamada junto de `organization_id = get_user_organization_id()` nas policies, então o risco é mitigado — mas a função em si é frágil se reutilizada incorretamente.

### RISCO MÉDIO #3: Trigger com URL hardcoded

```sql
-- Se Supabase URL mudar (nova instância após migração):
'https://aiflfkkjitvsyszwdfga.supabase.co'  -- ← hardcoded no trigger
```

**Impacto**: Push notifications param de funcionar silenciosamente. Necessita migration para atualizar `app_runtime_config`.

### RISCO MÉDIO #4: Verificação de Trial apenas no Frontend

```typescript
// ProtectedRoute.tsx
if (trialInfo?.is_trial_expired && !isDeveloperOrLeader) {
  return <TrialExpiredScreen />;
}
```

**Impacto**: Usuário pode usar DevTools para alterar estado React e contornar o bloqueio de trial no frontend. **O backend (RLS) não bloqueia acesso por trial diretamente** — só o `marketplace` tem RLS que verifica subscription.

**Para dados sensíveis fora do marketplace**: trial expired não impede acesso via queries diretas ao Supabase.

### RISCO BAIXO #5: Admin Allowlist com email hardcoded

```sql
INSERT INTO admin_allowlist (email) VALUES ('matheuslinspg@gmail.com');
```

Se este email não existir na nova instância, funções `is_system_admin()` nunca retornam true, bloqueando operações administrativas.

---

## 5. PONTOS DE EXTREMO CUIDADO NA MIGRAÇÃO

### 5.1 Funções SECURITY DEFINER precisam ser recriadas EXATAMENTE

Se as funções `get_user_organization_id`, `is_member_of_org`, etc. não estiverem presentes **antes** das policies RLS, as policies vão falhar. Ordem de migration: funções → policies.

### 5.2 Extension `pg_net` é obrigatória para push notifications

Sem `pg_net`, o trigger `push_on_notification_insert` falha silenciosamente. Verificar se a nova instância tem `pg_net` habilitado.

### 5.3 Trigger `on_auth_user_created` cria profiles automaticamente

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

Se este trigger não existir na nova instância, novos usuários não terão perfil → app quebra no login.

### 5.4 `app_runtime_config` precisa ter a URL correta da nova instância

```sql
-- Após migração, executar:
UPDATE app_runtime_config
SET config_value = 'https://NEW_PROJECT.supabase.co'
WHERE config_key = 'supabase_url';
```

### 5.5 RLS deve estar HABILITADA em todas as tabelas antes de migrar dados

A ordem correta:
1. Criar tabelas com RLS habilitada (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
2. Criar funções SECURITY DEFINER
3. Criar policies
4. Migrar dados
5. Verificar que service role bypassa RLS (comportamento padrão)

### 5.6 Seed data crítico

Os seguintes dados precisam existir antes do app funcionar:
- `admin_allowlist` com email do admin
- `subscription_plans` com os planos corretos
- `ai_billing_pricing` com pricing dos modelos
- `app_runtime_config` com URL da nova instância

### 5.7 JWT no formato correto para Edge Functions

Edge functions extraem `claims.sub` como userId:
```typescript
const { data: claimsData } = await userClient.auth.getClaims(token);
const userId = claimsData.claims.sub;
```

Esta API (`getClaims`) deve estar disponível na nova instância do SDK.

---

## 6. RESUMO DE RISCOS

| Risco | Área | Impacto | Probabilidade | Ação Recomendada |
|-------|------|---------|--------------|-----------------|
| Storage RLS sem org isolation | `storage.objects` | Alto - vazamento cross-org | Alta (políticas existentes) | Reescrever políticas de storage |
| `is_org_manager_or_above` sem org | Função SQL | Alto se mal usada | Baixa (uso atual correto) | Adicionar org_id como parâmetro |
| Trigger URL hardcoded | `notifications` | Médio - push quebra | Alta após migração | Atualizar `app_runtime_config` |
| Trial sem RLS | Acesso a dados | Médio - bypass frontend | Média | Adicionar check em RLS críticas |
| Admin email hardcoded | `admin_allowlist` | Alto - sem acesso admin | Alta após migração | Confirmar email antes de migrar |
| `pg_net` não disponível | Trigger push | Médio - sem push | Média | Verificar extensão na nova instância |
| Seed data ausente | Plans/Pricing | Alto - billing quebrado | Alta após migração | Script de seed para nova instância |

---

*Análise gerada por análise estática — nenhuma alteração foi feita no repositório.*
