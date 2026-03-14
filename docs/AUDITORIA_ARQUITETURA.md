# Habitae — Arquitetura de Auditoria v2.0

> Documento de referência para o sistema de auditoria em dois níveis.

---

## 1. Visão Geral

### Estado Atual
O Habitae possui **duas tabelas de log** que não se complementam:
- `activity_log` (7.167 registros): captura CUD via triggers — sem leitura, sem auth, sem contexto de sessão
- `audit_logs` (30 registros): usada pontualmente para ações em massa — schema limitado

### Proposta
**Unificar em uma única tabela `audit_events`** com schema rico, alimentada por 3 camadas:

| Camada | O que captura | Como |
|--------|--------------|------|
| **Triggers SQL** | CUD em entidades críticas (leads, properties, contracts, etc.) | `AFTER INSERT/UPDATE/DELETE` |
| **Edge Functions** | Auth, integrações, ações admin, erros | Logging server-side |
| **Frontend** | Navegação, visualizações, exportações, filtros | `useAuditLog()` hook |

### Dois Níveis de Acesso
| Nível | Quem | O que vê |
|-------|------|----------|
| **Auditoria Organizacional** | admin, sub_admin | Apenas eventos da própria `organization_id` |
| **Auditoria de Plataforma** | developer (system admin) | Todos os eventos, cross-org, com métricas globais |

---

## 2. Schema SQL — `audit_events`

```sql
CREATE TABLE public.audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  
  -- Contexto organizacional
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Quem executou
  user_id         uuid,                    -- auth.uid() do executor
  acting_role     text,                    -- role no momento da ação (admin, corretor, etc.)
  
  -- Sobre quem/o quê (target)
  target_user_id  uuid,                    -- quando a ação afeta outro usuário
  entity_type     text NOT NULL,           -- lead, property, contract, user, etc.
  entity_id       text,                    -- UUID da entidade afetada
  entity_name     text,                    -- nome legível (cache para evitar JOINs)
  parent_entity_type text,                 -- ex: entity=interaction, parent=lead
  parent_entity_id   text,
  
  -- O que aconteceu
  action          text NOT NULL,           -- ex: lead.updated, auth.login, permission.denied
  action_category text NOT NULL,           -- auth, read, create, update, delete, move, security, admin, integration, billing
  module          text,                    -- crm, imoveis, financeiro, contratos, marketing, agenda, admin, suporte
  description     text,                    -- frase legível: "João moveu lead 'Maria' de 'Novo' para 'Qualificado'"
  
  -- Diff de dados (apenas para updates)
  old_values      jsonb,                   -- snapshot dos campos antes
  new_values      jsonb,                   -- snapshot dos campos depois
  changed_fields  text[],                  -- array dos nomes dos campos alterados
  
  -- Contexto técnico
  metadata        jsonb DEFAULT '{}',      -- dados extras (filtros usados, query params, etc.)
  source          text DEFAULT 'web',      -- web, api, edge_function, trigger, cron, webhook
  status          text DEFAULT 'success',  -- success, denied, failed, error
  risk_level      text DEFAULT 'low',      -- low, medium, high, critical
  
  -- Sessão e dispositivo
  ip_address      inet,                    -- IP do request (capturado em edge functions)
  user_agent      text,                    -- browser/device info
  session_id      text,                    -- ID de sessão para correlacionar ações
  request_id      text,                    -- correlation ID para rastrear fluxos
  route           text                     -- rota/tela onde ocorreu (ex: /crm, /imoveis/123)
);

-- Índice principal: consultas por org + período
CREATE INDEX idx_audit_org_created ON audit_events (organization_id, created_at DESC);

-- Consultas por usuário
CREATE INDEX idx_audit_user_created ON audit_events (user_id, created_at DESC);

-- Consultas por entidade (timeline do lead/imóvel)
CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id, created_at DESC);

-- Filtro por ação
CREATE INDEX idx_audit_action ON audit_events (action, created_at DESC);

-- Filtro por status (para security dashboard)
CREATE INDEX idx_audit_status ON audit_events (status, risk_level, created_at DESC)
  WHERE status != 'success';

-- Filtro por módulo
CREATE INDEX idx_audit_module ON audit_events (module, created_at DESC);

-- Particionamento por mês (recomendado para >100k registros)
-- CREATE INDEX idx_audit_created ON audit_events (created_at DESC);
```

### Propósito de Cada Campo

| Campo | Propósito |
|-------|-----------|
| `organization_id` | Isolamento multi-tenant via RLS |
| `user_id` | Quem executou a ação |
| `acting_role` | Role snapshot — essencial se o role mudar depois |
| `target_user_id` | Quando ação afeta outro usuário (ex: atribuir lead, mudar role) |
| `entity_type` + `entity_id` | O que foi afetado |
| `entity_name` | Cache do nome para exibição sem JOINs adicionais |
| `parent_entity_type/id` | Hierarquia: interação→lead, comissão→contrato |
| `action` | Evento com namespace: `lead.updated`, `auth.login` |
| `action_category` | Agrupamento para filtros e dashboards |
| `module` | Módulo da aplicação para filtro de contexto |
| `description` | Texto humanizado para exibição direta na timeline |
| `old_values` / `new_values` | Diff completo para auditoria detalhada |
| `changed_fields` | Lista rápida sem precisar comparar JSONBs |
| `metadata` | Dados extras contextuais (filtros, parâmetros, etc.) |
| `source` | Origem do evento (frontend, trigger, cron, webhook) |
| `status` | Resultado: sucesso, negado por permissão, erro |
| `risk_level` | Classificação de risco para alertas |
| `ip_address` | Rastreabilidade de sessão e localização |
| `user_agent` | Identificação do dispositivo/browser |
| `session_id` | Correlação de múltiplas ações na mesma sessão |
| `request_id` | Rastreamento de fluxo completo (frontend→edge→DB) |
| `route` | Tela/página onde a ação ocorreu |

---

## 3. Taxonomia de Eventos

### Autenticação
| Evento | Risco | Source |
|--------|-------|--------|
| `auth.login` | low | edge_function |
| `auth.logout` | low | frontend |
| `auth.failed_login` | medium | edge_function |
| `auth.password_reset` | medium | edge_function |
| `auth.session_expired` | low | frontend |

### Navegação / Leitura
| Evento | Risco | Source |
|--------|-------|--------|
| `lead.viewed` | low | frontend |
| `property.viewed` | low | frontend |
| `contract.viewed` | medium | frontend |
| `commission.viewed` | medium | frontend |
| `report.viewed` | low | frontend |
| `export.generated` | medium | frontend |

### Criação
| Evento | Risco | Source |
|--------|-------|--------|
| `lead.created` | low | trigger |
| `property.created` | low | trigger |
| `contract.created` | medium | trigger |
| `task.created` | low | trigger |
| `appointment.created` | low | trigger |
| `invoice.created` | medium | trigger |
| `transaction.created` | medium | trigger |

### Edição / Atualização
| Evento | Risco | Source |
|--------|-------|--------|
| `lead.updated` | low | trigger |
| `lead.moved_stage` | low | trigger |
| `lead.assigned` | low | trigger |
| `lead.archived` | medium | trigger |
| `lead.reactivated` | low | trigger |
| `property.updated` | low | trigger |
| `property.status_changed` | medium | trigger |
| `property.price_changed` | medium | trigger |
| `contract.updated` | medium | trigger |
| `contract.status_changed` | high | trigger |
| `commission.updated` | high | trigger |
| `invoice.status_changed` | medium | trigger |
| `transaction.updated` | medium | trigger |

### Exclusão
| Evento | Risco | Source |
|--------|-------|--------|
| `lead.deleted` | high | trigger |
| `property.deleted` | high | trigger |
| `contract.deleted` | critical | trigger |
| `task.deleted` | low | trigger |

### Permissões e Segurança
| Evento | Risco | Source |
|--------|-------|--------|
| `permission.denied` | medium | frontend/edge |
| `role.changed` | high | trigger |
| `user.invited` | medium | edge_function |
| `user.invite_accepted` | low | edge_function |
| `user.removed` | high | edge_function |
| `user.profile_updated` | low | trigger |

### Administração
| Evento | Risco | Source |
|--------|-------|--------|
| `admin.maintenance_enabled` | critical | edge_function |
| `admin.maintenance_disabled` | high | edge_function |
| `admin.user_password_reset` | critical | edge_function |
| `admin.user_deleted` | critical | edge_function |
| `admin.data_export` | high | edge_function |
| `admin.bulk_action` | high | edge_function |

### Integrações
| Evento | Risco | Source |
|--------|-------|--------|
| `integration.meta_connected` | medium | edge_function |
| `integration.meta_sync_started` | low | edge_function |
| `integration.rd_station_connected` | medium | edge_function |
| `integration.webhook_received` | low | edge_function |
| `integration.import_started` | medium | edge_function |
| `integration.import_completed` | low | edge_function |

### Marketing / IA
| Evento | Risco | Source |
|--------|-------|--------|
| `ai.ad_generated` | low | edge_function |
| `ai.art_generated` | low | edge_function |
| `ai.video_generated` | low | edge_function |
| `ai.summary_generated` | low | edge_function |
| `ai.document_analyzed` | low | edge_function |

---

## 4. Políticas RLS

```sql
-- Habilitar RLS
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Developer vê tudo
CREATE POLICY "developers_full_access" ON audit_events
FOR SELECT TO authenticated
USING (is_system_admin());

-- Admin/Sub-admin vê apenas sua org
CREATE POLICY "org_admins_view_own_org" ON audit_events
FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

-- INSERT: apenas triggers e edge functions (service role)
-- Nenhuma política de INSERT para authenticated = apenas service_role pode inserir
-- Isso previne fabricação de logs por usuários

-- Alternativa: permitir INSERT apenas via função SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.insert_audit_event(
  p_organization_id uuid,
  p_user_id uuid,
  p_acting_role text,
  p_entity_type text,
  p_entity_id text,
  p_entity_name text,
  p_action text,
  p_action_category text,
  p_module text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_changed_fields text[] DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_source text DEFAULT 'trigger',
  p_status text DEFAULT 'success',
  p_risk_level text DEFAULT 'low',
  p_target_user_id uuid DEFAULT NULL,
  p_parent_entity_type text DEFAULT NULL,
  p_parent_entity_id text DEFAULT NULL,
  p_route text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_events (
    organization_id, user_id, acting_role, entity_type, entity_id,
    entity_name, action, action_category, module, description,
    old_values, new_values, changed_fields, metadata, source,
    status, risk_level, target_user_id, parent_entity_type,
    parent_entity_id, route
  ) VALUES (
    p_organization_id, p_user_id, p_acting_role, p_entity_type, p_entity_id,
    p_entity_name, p_action, p_action_category, p_module, p_description,
    p_old_values, p_new_values, p_changed_fields, p_metadata, p_source,
    p_status, p_risk_level, p_target_user_id, p_parent_entity_type,
    p_parent_entity_id, p_route
  );
END;
$$;
```

---

## 5. Estratégia de Captura por Camada

### Camada 1: Triggers SQL (Eventos de Escrita)
**Quando usar:** CUD em entidades de negócio — garantia de 100% de captura.

```sql
-- Exemplo: Trigger genérico para leads
CREATE OR REPLACE FUNCTION audit_lead_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action text;
  v_desc text;
  v_changed text[];
  v_old jsonb;
  v_new jsonb;
  v_risk text := 'low';
  v_role text;
BEGIN
  -- Detectar role do usuário
  SELECT ur.role::text INTO v_role
  FROM user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_action := 'lead.created';
    v_desc := 'Lead "' || NEW.name || '" criado';
    v_new := to_jsonb(NEW);
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'lead.deleted';
    v_desc := 'Lead "' || OLD.name || '" removido';
    v_old := to_jsonb(OLD);
    v_risk := 'high';
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_changed := ARRAY[]::text[];
    v_old := '{}'::jsonb;
    v_new := '{}'::jsonb;
    
    -- Detectar mudança de estágio
    IF OLD.lead_stage_id IS DISTINCT FROM NEW.lead_stage_id THEN
      v_action := 'lead.moved_stage';
      v_changed := array_append(v_changed, 'lead_stage_id');
      v_old := v_old || jsonb_build_object('lead_stage_id', OLD.lead_stage_id);
      v_new := v_new || jsonb_build_object('lead_stage_id', NEW.lead_stage_id);
      v_desc := 'Lead "' || NEW.name || '" movido de estágio';
    -- Detectar atribuição de corretor
    ELSIF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN
      v_action := 'lead.assigned';
      v_changed := array_append(v_changed, 'broker_id');
      v_old := v_old || jsonb_build_object('broker_id', OLD.broker_id);
      v_new := v_new || jsonb_build_object('broker_id', NEW.broker_id);
      v_desc := 'Lead "' || NEW.name || '" atribuído a novo corretor';
    -- Detectar arquivamento
    ELSIF OLD.is_active = true AND NEW.is_active = false THEN
      v_action := 'lead.archived';
      v_risk := 'medium';
      v_desc := 'Lead "' || NEW.name || '" arquivado';
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      v_action := 'lead.reactivated';
      v_desc := 'Lead "' || NEW.name || '" reativado';
    ELSE
      v_action := 'lead.updated';
      -- Capturar campos alterados
      IF OLD.name IS DISTINCT FROM NEW.name THEN v_changed := array_append(v_changed, 'name'); END IF;
      IF OLD.email IS DISTINCT FROM NEW.email THEN v_changed := array_append(v_changed, 'email'); END IF;
      IF OLD.phone IS DISTINCT FROM NEW.phone THEN v_changed := array_append(v_changed, 'phone'); END IF;
      IF OLD.estimated_value IS DISTINCT FROM NEW.estimated_value THEN v_changed := array_append(v_changed, 'estimated_value'); END IF;
      IF OLD.notes IS DISTINCT FROM NEW.notes THEN v_changed := array_append(v_changed, 'notes'); END IF;
      IF OLD.source IS DISTINCT FROM NEW.source THEN v_changed := array_append(v_changed, 'source'); END IF;
      v_desc := 'Lead "' || NEW.name || '" atualizado (' || array_to_string(v_changed, ', ') || ')';
    END IF;
    
    -- Ignorar updates irrelevantes (apenas position, score, updated_at)
    IF v_action = 'lead.updated' AND array_length(v_changed, 1) IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  PERFORM insert_audit_event(
    COALESCE(NEW.organization_id, OLD.organization_id),
    COALESCE(auth.uid(), NEW.created_by, OLD.created_by),
    COALESCE(v_role, 'system'),
    'lead',
    COALESCE(NEW.id, OLD.id)::text,
    COALESCE(NEW.name, OLD.name),
    v_action,
    CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'DELETE' THEN 'delete' ELSE 'update' END,
    'crm',
    v_desc,
    v_old,
    v_new,
    v_changed,
    '{}',
    'trigger',
    'success',
    v_risk
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
```

### Camada 2: Edge Functions (Eventos Server-Side)
Para auth, integrações e ações admin — captura IP, user-agent e request context.

```typescript
// Snippet para Edge Functions
async function logAuditEvent(req: Request, supabaseAdmin: any, event: {
  organization_id?: string;
  user_id: string;
  acting_role?: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  action: string;
  action_category: string;
  module?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status?: string;
  risk_level?: string;
}) {
  await supabaseAdmin.rpc('insert_audit_event', {
    p_organization_id: event.organization_id || null,
    p_user_id: event.user_id,
    p_acting_role: event.acting_role || 'system',
    p_entity_type: event.entity_type,
    p_entity_id: event.entity_id || null,
    p_entity_name: event.entity_name || null,
    p_action: event.action,
    p_action_category: event.action_category,
    p_module: event.module || null,
    p_description: event.description || null,
    p_source: 'edge_function',
    p_status: event.status || 'success',
    p_risk_level: event.risk_level || 'low',
    p_metadata: {
      ...event.metadata,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent'),
    },
    p_route: null,
  });
}
```

### Camada 3: Frontend Hook (Eventos de Leitura + Navegação)
```typescript
// useAuditLog.ts — hook para registrar eventos de leitura
function useAuditLog() {
  const { user, profile } = useAuth();
  const location = useLocation();
  
  const log = useCallback(async (event: {
    action: string;
    entity_type: string;
    entity_id?: string;
    entity_name?: string;
    module?: string;
    metadata?: Record<string, unknown>;
  }) => {
    await supabase.rpc('insert_audit_event', {
      p_organization_id: profile?.organization_id,
      p_user_id: user?.id,
      p_acting_role: userRole,
      p_entity_type: event.entity_type,
      p_entity_id: event.entity_id,
      p_entity_name: event.entity_name,
      p_action: event.action,
      p_action_category: 'read',
      p_module: event.module,
      p_source: 'web',
      p_route: location.pathname,
    });
  }, [user, profile, location]);

  return { log };
}
```

---

## 6. Queries de Exemplo

### Timeline de um Lead
```sql
SELECT created_at, action, description, user_id, acting_role,
       old_values, new_values, changed_fields, status
FROM audit_events
WHERE entity_type = 'lead' AND entity_id = '{lead_id}'
ORDER BY created_at DESC;
```

### Ações de um usuário nas últimas 24h
```sql
SELECT created_at, action, entity_type, entity_name, description, status
FROM audit_events
WHERE user_id = '{user_id}' AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

### Eventos de segurança (negados/falhas)
```sql
SELECT created_at, user_id, action, entity_type, description,
       metadata->>'ip' as ip, risk_level
FROM audit_events
WHERE status IN ('denied', 'failed')
  AND created_at > now() - interval '7 days'
ORDER BY risk_level DESC, created_at DESC;
```

### Top corretores por volume de ações (developer view)
```sql
SELECT user_id, COUNT(*) as total_actions,
       COUNT(*) FILTER (WHERE action_category = 'create') as creates,
       COUNT(*) FILTER (WHERE action_category = 'update') as updates,
       COUNT(*) FILTER (WHERE action LIKE 'lead.%') as lead_actions
FROM audit_events
WHERE created_at > now() - interval '30 days'
GROUP BY user_id
ORDER BY total_actions DESC;
```

### Organizações mais ativas (developer view)
```sql
SELECT organization_id, COUNT(*) as events,
       COUNT(DISTINCT user_id) as active_users,
       COUNT(*) FILTER (WHERE risk_level IN ('high','critical')) as high_risk
FROM audit_events
WHERE created_at > now() - interval '7 days'
GROUP BY organization_id
ORDER BY events DESC;
```

---

## 7. UI/UX Recomendado

### Tela do Dono (Admin) — `/atividades`
- **Filtros:** Período, Usuário, Módulo, Ação, Entidade
- **Timeline vertical** com ícones por tipo de evento
- **Drill-down:** clicar em um evento expande detalhes (old/new values, diff)
- **Mini-dashboard:** cards com totais do período (ações hoje, eventos de risco, top usuário)
- **Export CSV** dos eventos filtrados

### Tela do Developer — `/developer/auditoria`
- **Cross-org selector**: dropdown de organização ou "Todas"
- **Dashboard de segurança:** gráfico de eventos denied/failed, alertas de risk_level=critical
- **Busca global:** por user_id, email, entity_id, IP
- **Padrões suspeitos:** exportações em massa, logins de IPs incomuns, ações fora do horário
- **Heatmap de atividade** por hora/dia

---

## 8. LGPD e Retenção

| Tipo de Dado | Retenção | Mascaramento |
|-------------|----------|-------------|
| Eventos de navegação/leitura | 90 dias | Após 90 dias: anonimizar user_id |
| Eventos CUD de negócio | 2 anos | Manter íntegro |
| Eventos de segurança | 5 anos | Manter íntegro |
| IP/User-Agent | 6 meses | Após 6m: truncar IP para /24 |
| old_values/new_values com PII | 1 ano | Após 1 ano: mascarar email/phone |

### Job de limpeza (cron mensal)
```sql
-- Anonimizar eventos de leitura > 90 dias
UPDATE audit_events SET user_id = NULL, ip_address = NULL, user_agent = NULL
WHERE action_category = 'read' AND created_at < now() - interval '90 days';

-- Deletar eventos de navegação > 1 ano
DELETE FROM audit_events
WHERE action_category = 'read' AND created_at < now() - interval '1 year';
```

---

## 9. Alertas de Segurança

| Alerta | Condição | Risco |
|--------|----------|-------|
| Login de IP desconhecido | IP nunca antes visto para o user | medium |
| Exportação em massa | >3 exports em 1h pelo mesmo user | high |
| Acesso negado repetido | >5 permission.denied em 10min | high |
| Alteração de role | Qualquer role.changed | high |
| Exclusão em massa | >10 deletes em 5min | critical |
| Login fora do horário | auth.login entre 00h-05h (local) | medium |
| Acesso a leads de outra org | RLS blocked (status=denied + cross-org) | critical |

---

## 10. Plano de Implementação por Fases

### Fase 1 — Fundação (1-2 dias)
- [ ] Criar tabela `audit_events` com índices
- [ ] Criar função `insert_audit_event()` SECURITY DEFINER
- [ ] Criar políticas RLS
- [ ] Migrar dados existentes de `activity_log` → `audit_events`

### Fase 2 — Triggers de Escrita (1 dia)
- [ ] Trigger para `leads` (create, update, delete, stage_change, assign)
- [ ] Trigger para `properties` (create, update, delete, status_change, price_change)
- [ ] Trigger para `contracts` (create, update, status_change)
- [ ] Trigger para `user_roles` (role changed)
- [ ] Trigger para `commissions`, `invoices`, `transactions`

### Fase 3 — Edge Functions (1 dia)
- [ ] Auth events (login, failed login, password reset)
- [ ] Admin events (user delete, password reset, maintenance mode)
- [ ] Integration events (Meta connect, RD Station sync, imports)
- [ ] AI events (generation, analysis)

### Fase 4 — Frontend Hook + Leitura (1 dia)
- [ ] Hook `useAuditLog()` 
- [ ] Registrar `*.viewed` em páginas de detalhe (lead, property, contract)
- [ ] Registrar `export.generated` e `permission.denied`

### Fase 5 — UI do Dono (1-2 dias)
- [ ] Refatorar `/atividades` para usar `audit_events`
- [ ] Adicionar filtros avançados
- [ ] Timeline com drill-down de diff
- [ ] Mini-dashboard de KPIs

### Fase 6 — UI do Developer (1 dia)
- [ ] Tela `/developer/auditoria` cross-org
- [ ] Dashboard de segurança
- [ ] Busca global e padrões suspeitos

### Fase 7 — Manutenção (contínuo)
- [ ] Job de retenção/LGPD
- [ ] Alertas de segurança
- [ ] Depreciar `activity_log` e `audit_logs` antigas
