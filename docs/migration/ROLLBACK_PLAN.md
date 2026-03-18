# Plano de Rollback — Habitae
## Reversão: Novo Supabase → Lovable Cloud (Projeto Antigo)

**Versão**: 1.1
**Data de elaboração**: 2026-03-18
**Última revisão**: 2026-03-18 (incorporação de confirmações técnicas do Lovable)
**Janela de rollback válida**: até 2h após go-live

---

## Índice

1. [Filosofia do Rollback](#1-filosofia-do-rollback)
2. [Gatilhos para Ativar Rollback](#2-gatilhos-para-ativar-rollback)
3. [Janela de Rollback](#3-janela-de-rollback)
4. [O Que é Preservado](#4-o-que-é-preservado)
5. [Passo a Passo do Rollback](#5-passo-a-passo-do-rollback)
6. [Reversão de Serviços Externos](#6-reversão-de-serviços-externos)
7. [Recuperação de Dados do Período de Migração](#7-recuperação-de-dados-do-período-de-migração)
8. [Pós-Rollback](#8-pós-rollback)
9. [O Que NÃO Fazer Durante o Rollback](#9-o-que-não-fazer-durante-o-rollback)

---

## 1. Filosofia do Rollback

O rollback é possível e rápido porque o projeto Lovable antigo **NUNCA É DESLIGADO** durante a migração. Ele permanece ativo como snapshot point-in-time.

**Princípio**: O rollback é uma reversão de configuração, não de dados. Os dados do projeto antigo estão preservados. A mudança principal é apontar o frontend de volta ao projeto antigo.

**O que o rollback reverte**:
- Variáveis de ambiente do frontend (3 vars)
- Webhook URLs em serviços externos
- EDGE_BASE_URL no wa-worker

**O que o rollback NÃO reverte automaticamente**:
- Dados criados no novo projeto durante a janela de manutenção → extrair e importar manualmente
- Redirect_uris atualizados no Meta/RD Station (manter ambos ativos)

---

## 2. Gatilhos para Ativar Rollback

### CRÍTICO — Rollback imediato (não esperar)

| Cenário | Evidência |
|---------|-----------|
| Falha de autenticação para >50% dos usuários | Logs de auth mostrando 401/500 em massa |
| Dados de organização A visíveis para organização B | RLS comprometido — risco de segurança |
| Perda de dados confirmada (registros sumidos) | Contagem de tabelas inferior à origem |
| Billing completamente quebrado (Asaas) | 0 webhooks recebidos em 30 min |
| Frontend não carrega (erro 500 ou tela branca) | Relatório de usuários |

### ALTO — Rollback após tentativa de correção rápida (10 min)

| Cenário | Tentativa antes do rollback |
|---------|----------------------------|
| Taxa de erro 5xx > 10% por >10 min | Verificar logs, tentar identificar função específica |
| Edge function crítica retornando 500 | Verificar secret específico, tentar corrigir |
| Upload de imagens completamente quebrado | Verificar R2 secrets |
| Push notifications silenciosas | Verificar ONESIGNAL secrets |

### MÉDIO — Monitorar, não fazer rollback

| Cenário | Ação |
|---------|------|
| Alguns usuários precisando redefinir senha | Normal — comunicar via email |
| Meta/RD Ads sem dados novos | Normal — reautorização OAuth necessária |
| PWA com comportamento errático | Normal — cache expirará em 24h |
| Notificações duplicadas | Verificar lógica de device registration |

---

## 3. Janela de Rollback

```
T+0h  → Go-live: rollback instantâneo (zero dados a recuperar)
T+1h  → Rollback simples: recuperar ~1h de dados (poucos registros)
T+2h  → Rollback aceitável: recuperar ~2h de dados (script necessário)
T+4h  → Rollback complexo: muito delta, alta chance de conflitos
T+24h → Rollback inviável: dados novos demais, maior risco de perda
```

**Decisão recomendada**: Manter rollback como opção apenas nas primeiras 2h.
Após 2h, focar em corrigir o problema no novo ambiente.

---

## 4. O Que é Preservado

### Preservado automaticamente (no projeto Lovable antigo)

| Item | Estado |
|------|--------|
| Banco de dados completo (snapshot) | ✅ Intacto — nenhum dado foi deletado do antigo |
| Usuários e senhas (bcrypt) | ✅ Intactos |
| Edge Functions deployadas | ✅ Continuam deployadas |
| Secrets configurados (incluindo LOVABLE_API_KEY) | ✅ Continuam configurados |
| GUC app.settings.supabase_url (projeto antigo) | ✅ Aponta para o projeto antigo — trigger push funciona |
| Storage buckets | ✅ Se havia arquivos em Supabase storage |

### Não preservado automaticamente (ação manual necessária)

| Item | O que fazer |
|------|------------|
| Dados criados no novo projeto durante janela | Exportar e importar no antigo (ver Seção 7) |
| Redirect_uris atualizados (Meta, RD Station) | Manter ambas as URIs ativas durante período de rollback |
| ASAAS webhook apontando para novo projeto | Reverter URL no painel Asaas |
| GUC app.settings.supabase_url no novo projeto | Reverter para URL antiga — ou ignorar (novo projeto entrará em manutenção) |
| `src/main.tsx` redirect | **NÃO reverter** — o redirect `habitae1.lovable.app → portadocorretor.com.br` é benéfico e continua funcionando mesmo no projeto antigo |

---

## 5. Passo a Passo do Rollback

**Tempo total estimado**: 15-20 minutos

### ROLLBACK STEP 1 — Ativar modo manutenção no NOVO projeto

```bash
# Parar escritas no novo projeto imediatamente
curl -X POST \
  "https://NOVO_PROJECT_ID.supabase.co/functions/v1/toggle-maintenance-mode" \
  -H "Authorization: Bearer $NEW_SERVICE_ROLE_KEY" \
  -d '{"action": "enable", "message": "Retornando em instantes..."}'
```

**Duração**: 1 min

### ROLLBACK STEP 2 — Reverter variáveis de ambiente do frontend

**Local**: Lovable Dashboard → Settings → Environment Variables

```
VITE_SUPABASE_URL           = https://aiflfkkjitvsyszwdfga.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZmxma2tqaXR2c3lzendkZmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDEzNzksImV4cCI6MjA4NjkxNzM3OX0._GxDwg_psa_ReqNFPFT7S5mKbTz1ZKWS6xEIsbuP6LA
VITE_SUPABASE_PROJECT_ID    = aiflfkkjitvsyszwdfga
```

**Alternativa (CI/CD próprio)**:
```bash
git revert HEAD  # Reverter o commit de cutover
git push origin main
# Aguardar novo deploy (~5 min)
```

**Duração**: 5-10 min (inclui rebuild)

### ROLLBACK STEP 3 — Desativar modo manutenção no projeto ANTIGO

```bash
# Reativar o projeto antigo
curl -X POST \
  "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/toggle-maintenance-mode" \
  -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" \
  -d '{"action": "disable"}'
```

**Duração**: 1 min

### ROLLBACK STEP 4 — Verificar que o frontend voltou ao projeto antigo

```bash
# Verificar que a build aponta ao projeto antigo
curl https://SEU_DOMINIO.com.br/assets/index-*.js | grep -o "aiflfkkjitvsyszwdfga"
# Deve retornar o project ID antigo

# Testar login
curl -X POST \
  "https://aiflfkkjitvsyszwdfga.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $OLD_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario_teste@habitae.com.br", "password": "SENHA_ORIGINAL"}'
# Esperado: access_token válido
```

**Duração**: 2 min

### ROLLBACK STEP 4.5 — Reverter GUC de pg_net no novo projeto (opcional mas recomendado)

```bash
# No NOVO projeto (que vai entrar em manutenção): reverter GUC para evitar
# que o trigger continue tentando chamar funcões do novo projeto se ele for
# desligado no futuro. Apenas boa prática.
psql "$NEW_DB_URL" -c "ALTER DATABASE postgres RESET app.settings.supabase_url;"
psql "$NEW_DB_URL" -c "ALTER DATABASE postgres RESET app.settings.supabase_anon_key;"
```

> O projeto antigo não precisa de alteração de GUC — ele nunca foi modificado.
> O trigger do projeto antigo continua apontando para `aiflfkkjitvsyszwdfga.supabase.co` (correto).

### ROLLBACK STEP 5 — Reverter webhook do Asaas

**Local**: Painel Asaas → Configurações → Webhooks

```
URL a restaurar: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/billing-webhook
```

**Duração**: 3 min

### ROLLBACK STEP 6 — Reverter EDGE_BASE_URL no wa-worker

**Local**: Painel Easypanel → wa-worker → Variáveis de Ambiente

```
EDGE_BASE_URL = https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1
```

Reiniciar serviço após mudança.

**Duração**: 3 min

### ROLLBACK STEP 7 — Comunicar usuários

```
Enviar push/email:
"O sistema está de volta ao normal. Desculpe o transtorno."
```

---

## 6. Reversão de Serviços Externos

### Meta (Facebook) — redirect_uri

```
NÃO reverter imediatamente o redirect_uri do Meta.
Manter AMBAS as URIs ativas no Facebook App Developers:
  - https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/meta-oauth-callback (antigo)
  - https://NOVO_PROJECT_ID.supabase.co/functions/v1/meta-oauth-callback (novo)

Remover a URI nova apenas após decidir não migrar mais.
```

### RD Station — redirect_uri

```
Mesma estratégia do Meta: manter ambas as URIs ativas.
```

### DNS (se domínio customizado foi alterado)

```bash
# Se TTL foi reduzido para 300s com antecedência:
# Reverter CNAME/A record para o hosting antigo
# Aguardar propagação (5-15 min com TTL baixo)
```

---

## 7. Recuperação de Dados do Período de Migração

Se dados foram criados no novo projeto durante a janela de manutenção (improvável, mas possível se o modo manutenção falhou):

### 7.1 Exportar dados novos do projeto migrado

```bash
NEW_DB_URL="postgresql://postgres.NOVO_PROJECT_ID:NOVA_SENHA@..."
OLD_DB_URL="postgresql://postgres.aiflfkkjitvsyszwdfga:SENHA_ANTIGA@..."

# Identificar registros criados durante a janela (após o modo manutenção ter sido ativado)
MANUTENCAO_START="2026-03-18 02:00:00"

for table in properties leads lead_interactions contracts transactions tasks notifications; do
  psql "$NEW_DB_URL" -c \
    "COPY (SELECT * FROM $table WHERE created_at > '$MANUTENCAO_START') TO STDOUT WITH CSV HEADER" \
    > "rollback_delta/${table}_new.csv"
  COUNT=$(wc -l < "rollback_delta/${table}_new.csv")
  echo "$table: $COUNT novos registros a recuperar"
done
```

### 7.2 Importar dados recuperados no projeto antigo

```bash
# ⚠️ ATENÇÃO: os user_ids no novo projeto são DIFERENTES do antigo
# Precisar usar o mapeamento INVERSO: new_id → old_id

# Ler user_id_mapping.json e inverter
python3 -c "
import json
with open('user_id_mapping.json') as f:
    mapping = json.load(f)
# Inverter: {new_id: old_id}
inverse = {v: k for k, v in mapping.items()}
with open('user_id_mapping_inverse.json', 'w') as f:
    json.dump(inverse, f, indent=2)
print('Mapeamento invertido gerado')
"

# Aplicar mapeamento inverso e importar
# Isso requer script customizado por tabela para substituir user_ids
```

> ⚠️ Se o volume de dados novos for muito pequeno (< 10 registros), pode ser mais rápido
> inserir manualmente via SQL do que automatizar.

---

## 8. Pós-Rollback

### Imediatamente após rollback:

1. **Documentar o motivo**: Qual foi o problema que causou o rollback? Ser específico.
2. **Preservar logs**: Exportar logs do novo projeto antes que expirem (Supabase retém 7 dias).
3. **Preservar estado do novo projeto**: NÃO deletar o novo projeto Supabase imediatamente.
4. **Post-mortem**: Agendar reunião de 1h nas próximas 24h para análise.

### Planejamento da próxima tentativa:

| Causa do Rollback | Resolução antes da próxima tentativa |
|------------------|-------------------------------------|
| User UUID migration incompleta | Melhorar script de mapeamento e testar em staging |
| Secrets faltando | Usar checklist completa e validar antes de cutover |
| RLS quebrado | Testar mais exaustivamente em staging com dados reais |
| Edge function com erro | Corrigir e testar a função específica |
| Delta de dados muito grande | Reduzir janela de manutenção → começar mais cedo |

### Antes da próxima tentativa de migração:

- [ ] Corrigir todas as causas identificadas no post-mortem
- [ ] Realizar migração completa em ambiente de staging com cópia dos dados de produção
- [ ] Aprovação do time antes de nova tentativa em produção

---

## 9. O Que NÃO Fazer Durante o Rollback

| Ação proibida | Por quê |
|--------------|---------|
| ❌ Deletar o novo projeto Supabase | Pode conter dados necessários para análise |
| ❌ Forçar git reset --hard no repo | Perde o commit de configuração de cutover (útil para debug) |
| ❌ Remover redirect_uris do Meta/RD Station imediatamente | Quebra links de OAuth em uso |
| ❌ Invalidar tokens de sessão existentes no projeto antigo | Força logout desnecessário de todos |
| ❌ Alterar senhas ou user_ids no projeto antigo | Dados antigos devem permanecer intactos |
| ❌ Executar o rollback sem ativar manutenção no novo projeto primeiro | Cria split-brain: usuários escrevem em dois lugares |

---

## Referências Rápidas (Valores do Projeto Antigo)

```
# PROJETO ANTIGO (Lovable Cloud) — Guardar em local seguro
Project ID  : aiflfkkjitvsyszwdfga
URL         : https://aiflfkkjitvsyszwdfga.supabase.co
Anon Key    : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZmxma2tqaXR2c3lzendkZmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDEzNzksImV4cCI6MjA4NjkxNzM3OX0._GxDwg_psa_ReqNFPFT7S5mKbTz1ZKWS6xEIsbuP6LA
Service Role: (obter do Lovable Dashboard antes da migração — NÃO commitar em repo)

Webhook Asaas antigo: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/billing-webhook
EDGE_BASE_URL antigo : https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1
```

---

*Documento versão 1.1 — Revisado em: 2026-03-18*
*Anterior: [CUTOVER_STRATEGY.md](./CUTOVER_STRATEGY.md)*
*Próximo: [EDGE_FUNCTIONS_DEPLOYMENT_PLAN.md](./EDGE_FUNCTIONS_DEPLOYMENT_PLAN.md)*
