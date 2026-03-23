#!/usr/bin/env node
/**
 * run-explain.js — Porta do Corretor
 *
 * Executa EXPLAIN ANALYZE nas 10 queries críticas via API REST do Supabase,
 * interpreta os resultados e gera:
 *   - reports/performance-report.md
 *   - supabase/migrations/<timestamp>_performance_fixes.sql
 *
 * Uso:
 *   node scripts/run-explain.js
 *
 * Variáveis de ambiente necessárias (lidas do .env):
 *   VITE_SUPABASE_URL              — URL do projeto Supabase
 *   VITE_SUPABASE_PUBLISHABLE_KEY  — Anon key (leitura pública)
 *   SUPABASE_SERVICE_ROLE_KEY      — Service role key (EXPLAIN requer db.plan)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/** Lê e parseia o arquivo .env manualmente (sem dependências externas). */
function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) {
    console.error('\x1b[31m✖ Arquivo .env não encontrado em ' + envPath + '\x1b[0m');
    console.error('  Crie o .env com as variáveis VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const env = {};
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  });
  return env;
}

/** Cores ANSI para terminal. */
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

function colorStatus(ms) {
  if (ms < 50)  return `${C.green}✅ OK      ${C.reset}`;
  if (ms < 200) return `${C.yellow}⚠️  LENTO   ${C.reset}`;
  return              `${C.red}❌ CRÍTICO ${C.reset}`;
}

function diagLabel(ms) {
  if (ms < 50)  return '✅ OK';
  if (ms < 200) return '⚠️ ATENÇÃO';
  return              '❌ CRÍTICO';
}

// ---------------------------------------------------------------------------
// Definição das 10 queries
// ---------------------------------------------------------------------------

/**
 * Cada entrada descreve como chamar a query via PostgREST.
 *
 * type: 'table' | 'rpc'
 *
 * Para 'table': method GET, path /rest/v1/<table>?<params>
 * Para 'rpc':   method POST, path /rest/v1/rpc/<fn>, body = args JSON
 *
 * O header `Accept: application/vnd.pgrst.plan` instrui o PostgREST a
 * retornar o plano de execução em vez dos dados. Requer service role key
 * para contornar o RLS e ter acesso ao db.plan.
 */
const PLACEHOLDER_ORG = '00000000-0000-0000-0000-000000000000';
const PLACEHOLDER_USER = '00000000-0000-0000-0000-000000000000';
const PLACEHOLDER_LEAD = '00000000-0000-0000-0000-000000000000';

const now = new Date();
const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

const QUERIES = [
  {
    id: 1,
    name: 'fn_dashboard_stats',
    hook: 'useDashboardStats',
    description: 'Agrega contagens de imóveis, leads, contratos e transações de uma org',
    type: 'rpc',
    fn: 'fn_dashboard_stats',
    body: { p_org_id: PLACEHOLDER_ORG },
    needsServiceRole: true,
    tables: ['properties', 'leads', 'contracts', 'transactions'],
  },
  {
    id: 2,
    name: 'fn_kpi_metrics',
    hook: 'useDashboardKPIs',
    description: 'KPIs do período atual e anterior (leads, visitas, propostas, fechamentos)',
    type: 'rpc',
    fn: 'fn_kpi_metrics',
    body: {
      p_org_id: PLACEHOLDER_ORG,
      p_start: thirtyDaysAgo.toISOString(),
      p_end: now.toISOString(),
    },
    needsServiceRole: true,
    tables: ['leads', 'appointments', 'contracts', 'lead_stages'],
  },
  {
    id: 3,
    name: 'fn_agent_ranking',
    hook: 'useDashboardRanking',
    description: 'Ranking de corretores com correlated subqueries por agente',
    type: 'rpc',
    fn: 'fn_agent_ranking',
    body: {
      p_org_id: PLACEHOLDER_ORG,
      p_start: thirtyDaysAgo.toISOString(),
      p_end: now.toISOString(),
    },
    needsServiceRole: true,
    tables: ['profiles', 'user_roles', 'leads', 'appointments', 'contracts', 'lead_interactions'],
  },
  {
    id: 4,
    name: 'properties_list',
    hook: 'useProperties',
    description: 'Listagem de imóveis com joins em property_types e property_images',
    type: 'table',
    path: '/rest/v1/properties',
    params: {
      select: '*,property_type:property_types(*),images:property_images(id,url,is_cover,display_order,r2_key_full,r2_key_thumb,storage_provider,cached_thumbnail_url,image_type)',
      organization_id: `eq.${PLACEHOLDER_ORG}`,
      order: 'created_at.desc',
      limit: '1000',
    },
    needsServiceRole: true,
    tables: ['properties', 'property_types', 'property_images'],
  },
  {
    id: 5,
    name: 'leads_kanban',
    hook: 'useLeads',
    description: 'Leads ativos para kanban — sem filtro explícito de org (RLS filtra)',
    type: 'table',
    path: '/rest/v1/leads',
    params: {
      select: '*,lead_type:lead_types(*),interested_property_type:property_types(*)',
      is_active: 'eq.true',
      order: 'position.asc',
    },
    needsServiceRole: true,
    tables: ['leads', 'lead_types', 'property_types'],
  },
  {
    id: 6,
    name: 'lead_interactions',
    hook: 'useLeadInteractions',
    description: 'Interações de um lead específico ordenadas por data',
    type: 'table',
    path: '/rest/v1/lead_interactions',
    params: {
      select: 'id,lead_id,type,description,occurred_at,created_by,created_at,appointment_id',
      lead_id: `eq.${PLACEHOLDER_LEAD}`,
      order: 'occurred_at.desc',
    },
    needsServiceRole: true,
    tables: ['lead_interactions'],
  },
  {
    id: 7,
    name: 'contracts_list',
    hook: 'useContracts',
    description: 'Contratos da org (sem joins — JOINs em profiles/leads/properties feitos em paralelo)',
    type: 'table',
    path: '/rest/v1/contracts',
    params: {
      select: 'id,code,type,status,value,commission_percentage,start_date,end_date,payment_day,readjustment_index,notes,property_id,lead_id,broker_id,created_at,created_by,updated_at,organization_id',
      organization_id: `eq.${PLACEHOLDER_ORG}`,
      order: 'created_at.desc',
    },
    needsServiceRole: true,
    tables: ['contracts'],
  },
  {
    id: 8,
    name: 'transactions_list',
    hook: 'useTransactions',
    description: 'Transações da org com joins em categories e contracts — LIMIT 500',
    type: 'table',
    path: '/rest/v1/transactions',
    params: {
      select: 'id,type,description,amount,date,paid,paid_at,notes,category_id,contract_id,organization_id,created_by,created_at,category:transaction_categories(id,name),contract:contracts(id,code)',
      organization_id: `eq.${PLACEHOLDER_ORG}`,
      order: 'date.desc',
      limit: '500',
    },
    needsServiceRole: true,
    tables: ['transactions', 'transaction_categories', 'contracts'],
  },
  {
    id: 9,
    name: 'marketplace_city_search',
    hook: 'useMarketplace',
    description: 'Busca pública no marketplace filtrada por cidade com ILIKE — risco de Seq Scan',
    type: 'table',
    path: '/rest/v1/marketplace_properties_public',
    params: {
      select: '*',
      status: 'eq.disponivel',
      organization_id: `neq.${PLACEHOLDER_ORG}`,
      address_city: 'ilike.*Paulo*',
      order: 'is_featured.desc,created_at.desc',
      limit: '12',
    },
    needsServiceRole: true,
    tables: ['marketplace_properties', 'marketplace_properties_public'],
  },
  {
    id: 10,
    name: 'notifications_user',
    hook: 'useNotifications',
    description: 'Notificações do usuário — também usado em subscription realtime',
    type: 'table',
    path: '/rest/v1/notifications',
    params: {
      select: '*',
      user_id: `eq.${PLACEHOLDER_USER}`,
      order: 'created_at.desc',
      limit: '50',
    },
    needsServiceRole: false, // anon key suficiente para leitura com RLS
    tables: ['notifications'],
  },
];

// ---------------------------------------------------------------------------
// Execução via PostgREST com header de plano
// ---------------------------------------------------------------------------

/**
 * Executa uma query via PostgREST com Accept: application/vnd.pgrst.plan.
 * Retorna o texto do plano ou lança um erro com detalhes.
 */
async function fetchPlan(query, supabaseUrl, anonKey, serviceRoleKey) {
  const key = query.needsServiceRole ? serviceRoleKey : anonKey;
  const headers = {
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
    'Accept':        'application/vnd.pgrst.plan',
    'Prefer':        'analyze=true, buffers=true, format=text',
  };

  let url, method, body;

  if (query.type === 'rpc') {
    url = `${supabaseUrl}/rest/v1/rpc/${query.fn}`;
    method = 'POST';
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(query.body);
  } else {
    const qs = new URLSearchParams(query.params).toString();
    url = `${supabaseUrl}${query.path}?${qs}`;
    method = 'GET';
  }

  const start = Date.now();
  const res = await fetch(url, { method, headers, body });
  const elapsed = Date.now() - start;

  const text = await res.text();

  if (!res.ok) {
    return {
      ok: false,
      error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
      planText: null,
      elapsedMs: elapsed,
    };
  }

  return { ok: true, planText: text, elapsedMs: elapsed, error: null };
}

// ---------------------------------------------------------------------------
// Parser do texto EXPLAIN ANALYZE
// ---------------------------------------------------------------------------

function parsePlan(planText) {
  if (!planText) return {};

  const result = {
    executionMs:      null,
    planningMs:       null,
    totalCostHigh:    null,
    estimatedRows:    null,
    actualRows:       null,
    seqScans:         [],
    rowsRemoved:      [],
    buffersHit:       null,
    buffersRead:      null,
    hasHashJoin:      false,
    hasNestedLoop:    false,
    hasIndexScan:     false,
  };

  // Execution Time
  const execMatch = planText.match(/Execution Time:\s*([\d.]+)\s*ms/i);
  if (execMatch) result.executionMs = parseFloat(execMatch[1]);

  // Planning Time
  const planMatch = planText.match(/Planning Time:\s*([\d.]+)\s*ms/i);
  if (planMatch) result.planningMs = parseFloat(planMatch[1]);

  // Total cost (from root node "cost=X..Y")
  const costMatches = [...planText.matchAll(/cost=[\d.]+\.\.([\d.]+)/g)];
  if (costMatches.length > 0) {
    // First match is the root node
    result.totalCostHigh = parseFloat(costMatches[0][1]);
  }

  // Estimated rows (from root node "rows=N")
  const rowsEst = planText.match(/rows=(\d+)\s+width=/);
  if (rowsEst) result.estimatedRows = parseInt(rowsEst[1], 10);

  // Actual rows (from root node "actual ... rows=N")
  const rowsAct = planText.match(/actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/);
  if (rowsAct) result.actualRows = parseInt(rowsAct[1], 10);

  // Seq Scans
  const seqMatches = [...planText.matchAll(/Seq Scan on (\w+)/g)];
  result.seqScans = [...new Set(seqMatches.map((m) => m[1]))];

  // Rows Removed by Filter
  const removedMatches = [...planText.matchAll(/Rows Removed by Filter:\s*(\d+)/g)];
  result.rowsRemoved = removedMatches.map((m) => parseInt(m[1], 10));

  // Buffers
  const bufHit  = planText.match(/shared hit=(\d+)/);
  const bufRead = planText.match(/shared read=(\d+)/);
  if (bufHit)  result.buffersHit  = parseInt(bufHit[1],  10);
  if (bufRead) result.buffersRead = parseInt(bufRead[1], 10);

  // Join types
  result.hasHashJoin    = /Hash Join/i.test(planText);
  result.hasNestedLoop  = /Nested Loop/i.test(planText);
  result.hasIndexScan   = /Index.*Scan/i.test(planText);

  return result;
}

// ---------------------------------------------------------------------------
// Diagnóstico automático
// ---------------------------------------------------------------------------

function diagnose(query, parsed, elapsedMs) {
  const issues = [];
  const suggestions = [];
  const indexSuggestions = [];

  const ms = parsed.executionMs ?? elapsedMs;

  // Seq Scans
  if (parsed.seqScans.length > 0) {
    const tables = parsed.seqScans.join(', ');
    issues.push(`Seq Scan detectado em: ${tables}`);
    parsed.seqScans.forEach((tbl) => {
      suggestions.push(`Criar índice em \`${tbl}\` nas colunas usadas no WHERE/ORDER BY.`);
      // Sugestões específicas por tabela
      if (tbl === 'lead_interactions') {
        indexSuggestions.push(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_interactions_lead_occurred\n  ON public.lead_interactions(lead_id, occurred_at DESC);`
        );
      }
      if (tbl === 'leads') {
        indexSuggestions.push(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_org_active_position\n  ON public.leads(organization_id, is_active, position ASC);`
        );
        indexSuggestions.push(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_org_created\n  ON public.leads(organization_id, created_at DESC);`
        );
      }
      if (tbl === 'transactions') {
        indexSuggestions.push(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_org_date\n  ON public.transactions(organization_id, date DESC);`
        );
      }
      if (tbl === 'contracts') {
        indexSuggestions.push(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_org_created\n  ON public.contracts(organization_id, created_at DESC);`
        );
      }
      if (tbl === 'appointments') {
        indexSuggestions.push(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_org_start_completed\n  ON public.appointments(organization_id, start_time, completed);`
        );
      }
      if (tbl === 'marketplace_properties' || tbl === 'marketplace_properties_public') {
        indexSuggestions.push(
          `-- Habilitar extensão trigram para ILIKE eficiente:\nCREATE EXTENSION IF NOT EXISTS pg_trgm;\n\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_city_trgm\n  ON public.marketplace_properties USING GIN(address_city gin_trgm_ops);\n\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_status_featured_created\n  ON public.marketplace_properties(status, is_featured DESC, created_at DESC)\n  WHERE status = 'disponivel';`
        );
      }
      if (tbl === 'notifications') {
        indexSuggestions.push(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created\n  ON public.notifications(user_id, created_at DESC);`
        );
      }
    });
  }

  // Rows Removed
  const totalRemoved = parsed.rowsRemoved.reduce((a, b) => a + b, 0);
  if (totalRemoved > 1000) {
    issues.push(`${totalRemoved} linhas removidas pelo filtro (filtro ineficiente)`);
    suggestions.push('Revisar predicados WHERE; considerar índice parcial ou composto.');
  }

  // High cost
  if (parsed.totalCostHigh !== null && parsed.totalCostHigh > 1000) {
    issues.push(`Custo estimado alto: ${parsed.totalCostHigh.toFixed(1)}`);
    suggestions.push('Query pesada — avaliar particionamento, materialização ou cache.');
  }

  // Buffer cache miss
  if (parsed.buffersRead !== null && parsed.buffersHit !== null) {
    const total = parsed.buffersHit + parsed.buffersRead;
    const hitRate = total > 0 ? (parsed.buffersHit / total) * 100 : 100;
    if (hitRate < 90 && total > 10) {
      issues.push(`Cache hit rate baixo: ${hitRate.toFixed(1)}% (hit=${parsed.buffersHit}, read=${parsed.buffersRead})`);
      suggestions.push('Páginas lidas do disco — ajustar shared_buffers ou reduzir volume de dados.');
    }
  }

  // N+1 warning para fn_agent_ranking
  if (query.name === 'fn_agent_ranking') {
    issues.push('Padrão N+1 detectado: correlated subqueries por corretor na função fn_agent_ranking');
    suggestions.push(
      'Reescrever fn_agent_ranking usando CTEs com agregações em batch em vez de subqueries correlacionadas.'
    );
    indexSuggestions.push(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_broker_org_active\n  ON public.leads(broker_id, organization_id) WHERE is_active = true;\n\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_assigned_org_completed\n  ON public.appointments(assigned_to, organization_id, start_time) WHERE completed = true;\n\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_broker_org_created\n  ON public.contracts(broker_id, organization_id, created_at);\n\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_interactions_created_by_created\n  ON public.lead_interactions(created_by, created_at);`
    );
  }

  return { issues, suggestions, indexSuggestions };
}

// ---------------------------------------------------------------------------
// Formatação do relatório Markdown
// ---------------------------------------------------------------------------

function buildReport(results) {
  const lines = [
    '# Relatório de Performance — Porta do Corretor',
    '',
    `> Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    '',
    '---',
    '',
  ];

  const allIndexSuggestions = new Set();
  const slowRPCs = [];

  // Seção por query
  for (const r of results) {
    const ms = r.parsed?.executionMs ?? r.elapsedMs;
    const label = diagLabel(ms);

    lines.push(`## Query ${r.query.id}: \`${r.query.name}\``);
    lines.push('');
    lines.push(`**Hook:** \`${r.query.hook}\`  `);
    lines.push(`**Descrição:** ${r.query.description}  `);
    lines.push(`**Tabelas:** ${r.query.tables.join(', ')}`);
    lines.push('');

    if (!r.ok) {
      lines.push(`> ⚠️ Não foi possível obter o plano: \`${r.error}\``);
      lines.push('');
      lines.push('---');
      lines.push('');
      continue;
    }

    // Métricas
    lines.push('### Métricas');
    lines.push('');
    lines.push(`| Métrica | Valor |`);
    lines.push(`|---------|-------|`);
    lines.push(`| Tempo de execução | **${ms?.toFixed(2) ?? 'n/a'} ms** |`);
    if (r.parsed?.planningMs !== null) lines.push(`| Tempo de planejamento | ${r.parsed.planningMs} ms |`);
    if (r.parsed?.totalCostHigh !== null) lines.push(`| Custo estimado (máx) | ${r.parsed.totalCostHigh} |`);
    if (r.parsed?.estimatedRows !== null) lines.push(`| Linhas estimadas | ${r.parsed.estimatedRows} |`);
    if (r.parsed?.actualRows !== null) lines.push(`| Linhas retornadas | ${r.parsed.actualRows} |`);
    const totalRemoved = (r.parsed?.rowsRemoved ?? []).reduce((a, b) => a + b, 0);
    if (totalRemoved > 0) lines.push(`| Linhas removidas pelo filtro | ${totalRemoved} |`);
    if (r.parsed?.buffersHit !== null) lines.push(`| Buffers (hit) | ${r.parsed.buffersHit} |`);
    if (r.parsed?.buffersRead !== null) lines.push(`| Buffers (read) | ${r.parsed.buffersRead} |`);
    lines.push('');

    // Diagnóstico
    lines.push(`### Diagnóstico: ${label}`);
    lines.push('');

    if (r.diag.issues.length === 0) {
      lines.push('Sem problemas identificados.');
    } else {
      lines.push('**Problemas encontrados:**');
      r.diag.issues.forEach((i) => lines.push(`- ${i}`));
      lines.push('');
      lines.push('**Sugestões:**');
      r.diag.suggestions.forEach((s) => lines.push(`- ${s}`));
    }
    lines.push('');

    // Plano completo (colapsado)
    if (r.planText) {
      lines.push('<details>');
      lines.push('<summary>Ver plano completo (EXPLAIN ANALYZE)</summary>');
      lines.push('');
      lines.push('```');
      lines.push(r.planText.trim());
      lines.push('```');
      lines.push('');
      lines.push('</details>');
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Acumular índices
    r.diag.indexSuggestions.forEach((s) => allIndexSuggestions.add(s));

    // RPCs lentas
    if (r.query.type === 'rpc' && ms > 50) {
      slowRPCs.push(r.query.name);
    }
  }

  // Ranking das 3 mais lentas
  lines.push('## Ranking: 3 Queries Mais Lentas');
  lines.push('');
  const sorted = [...results]
    .filter((r) => r.parsed?.executionMs != null)
    .sort((a, b) => (b.parsed.executionMs) - (a.parsed.executionMs))
    .slice(0, 3);

  if (sorted.length === 0) {
    lines.push('Nenhuma query com dados de tempo de execução disponíveis.');
  } else {
    sorted.forEach((r, i) => {
      lines.push(`${i + 1}. **\`${r.query.name}\`** — ${r.parsed.executionMs.toFixed(2)} ms`);
    });
  }
  lines.push('');

  // Índices sugeridos
  lines.push('## Índices Sugeridos (CREATE INDEX)');
  lines.push('');
  if (allIndexSuggestions.size === 0) {
    lines.push('Nenhum índice adicional identificado como necessário.');
  } else {
    lines.push('```sql');
    [...allIndexSuggestions].forEach((idx) => {
      lines.push(idx);
      lines.push('');
    });
    lines.push('```');
  }
  lines.push('');

  // RPCs para reescrita
  lines.push('## RPCs Candidatas à Reescrita');
  lines.push('');
  if (slowRPCs.length === 0) {
    lines.push('Nenhuma RPC identificada como candidata à reescrita.');
  } else {
    slowRPCs.forEach((rpc) => lines.push(`- \`${rpc}\``));
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('> Relatório gerado por `scripts/run-explain.js`. Execute novamente após aplicar as migrations para comparar a performance.');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Geração da migration de índices
// ---------------------------------------------------------------------------

function buildMigration(results) {
  const allIndexSuggestions = new Set();
  for (const r of results) {
    r.diag.indexSuggestions.forEach((s) => allIndexSuggestions.add(s));
  }

  if (allIndexSuggestions.size === 0) {
    return null; // nada a fazer
  }

  const lines = [
    '-- ============================================================',
    '-- Migration gerada automaticamente por scripts/run-explain.js',
    `-- Data: ${new Date().toISOString()}`,
    '--',
    '-- Aplica os índices identificados como necessários pela análise',
    '-- de performance. Todos os índices usam IF NOT EXISTS e',
    '-- CONCURRENTLY para não bloquear a tabela durante a criação.',
    '-- ============================================================',
    '',
    '-- IMPORTANTE: CONCURRENTLY não pode rodar dentro de uma transação.',
    '-- Execute este arquivo com: supabase db push',
    '-- ou: psql "$DATABASE_URL" -f <este_arquivo>',
    '',
  ];

  [...allIndexSuggestions].forEach((idx) => {
    lines.push(idx);
    lines.push('');
  });

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${C.bold}${C.cyan}══════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  Porta do Corretor — Análise de Performance  ${C.reset}`);
  console.log(`${C.bold}${C.cyan}══════════════════════════════════════════════${C.reset}\n`);

  // Carregar env
  const env = loadEnv();
  const SUPABASE_URL = env['VITE_SUPABASE_URL'];
  const ANON_KEY     = env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!SUPABASE_URL || !ANON_KEY) {
    console.error(`${C.red}✖ VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias no .env${C.reset}`);
    process.exit(1);
  }

  if (!SERVICE_KEY) {
    console.warn(`${C.yellow}⚠ SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.`);
    console.warn(`  EXPLAIN ANALYZE requer a service role key para acessar db.plan.`);
    console.warn(`  Adicione: SUPABASE_SERVICE_ROLE_KEY=eyJ... no seu .env${C.reset}\n`);
  }

  console.log(`${C.gray}URL: ${SUPABASE_URL}${C.reset}`);
  console.log(`${C.gray}Anon key: ${ANON_KEY.slice(0, 20)}...${C.reset}`);
  console.log(`${C.gray}Service key: ${SERVICE_KEY ? SERVICE_KEY.slice(0, 20) + '...' : 'NÃO CONFIGURADA'}${C.reset}\n`);

  // Executar queries
  const results = [];
  for (const query of QUERIES) {
    process.stdout.write(`  [${query.id.toString().padStart(2, '0')}/10] ${query.name.padEnd(30, ' ')} `);

    let result;
    try {
      result = await fetchPlan(query, SUPABASE_URL, ANON_KEY, SERVICE_KEY);
    } catch (err) {
      result = { ok: false, error: err.message, planText: null, elapsedMs: 0 };
    }

    const parsed = result.ok ? parsePlan(result.planText) : {};
    const diag = diagnose(query, parsed, result.elapsedMs);

    const ms = parsed.executionMs ?? result.elapsedMs;
    console.log(`${colorStatus(ms)} ${ms?.toFixed(1) ?? '?'} ms`);

    results.push({ query, ok: result.ok, error: result.error, planText: result.planText, elapsedMs: result.elapsedMs, parsed, diag });
  }

  console.log('');

  // Criar diretório reports/
  const reportsDir = resolve(ROOT, 'reports');
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

  // Gerar relatório Markdown
  const reportPath = resolve(reportsDir, 'performance-report.md');
  writeFileSync(reportPath, buildReport(results), 'utf8');
  console.log(`${C.green}✔ Relatório gerado:${C.reset} reports/performance-report.md`);

  // Gerar migration
  const migrationSql = buildMigration(results);
  if (migrationSql) {
    const migrationsDir = resolve(ROOT, 'supabase', 'migrations');
    const ts = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const migrationPath = resolve(migrationsDir, `${ts}_performance_fixes.sql`);
    writeFileSync(migrationPath, migrationSql, 'utf8');
    console.log(`${C.green}✔ Migration gerada:${C.reset} supabase/migrations/${ts}_performance_fixes.sql`);
    console.log(`${C.gray}  Aplicar com: supabase db push${C.reset}`);
  } else {
    console.log(`${C.green}✔ Nenhum índice adicional necessário — migration não gerada.${C.reset}`);
  }

  // Resumo final
  const ok      = results.filter((r) => r.ok && (r.parsed?.executionMs ?? r.elapsedMs) < 50).length;
  const slow    = results.filter((r) => r.ok && (r.parsed?.executionMs ?? r.elapsedMs) >= 50 && (r.parsed?.executionMs ?? r.elapsedMs) < 200).length;
  const crit    = results.filter((r) => r.ok && (r.parsed?.executionMs ?? r.elapsedMs) >= 200).length;
  const errors  = results.filter((r) => !r.ok).length;

  console.log(`\n${C.bold}Resumo${C.reset}`);
  console.log(`  ${C.green}✅ OK:${C.reset}      ${ok}`);
  console.log(`  ${C.yellow}⚠️  Lentos:${C.reset}  ${slow}`);
  console.log(`  ${C.red}❌ Críticos:${C.reset} ${crit}`);
  if (errors > 0) console.log(`  ${C.gray}✖ Erros:${C.reset}    ${errors} (ver relatório para detalhes)`);
  console.log('');
}

main().catch((err) => {
  console.error(`\n${C.red}Erro fatal:${C.reset}`, err.message);
  process.exit(1);
});
