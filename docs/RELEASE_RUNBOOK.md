# Runbook de Release & Incidentes - Habitae

## Ambientes

| Ambiente | URL | Descrição |
|----------|-----|-----------|
| **Test** | `https://id-preview--*.lovable.app` | Ambiente de desenvolvimento/teste (Lovable Editor) |
| **Production** | `https://habitae1.lovable.app` | Ambiente publicado para usuários finais |

- Banco de dados: cada ambiente tem dados isolados (Test ≠ Live)
- Deploy de código: via botão **Publish** no Lovable Editor
- Edge Functions: deploy automático ao salvar no editor

## Política de Branches

- **Branch padrão**: `main`
- **Política de merge**: Todo código passa pelo Lovable Editor → commit automático → push para `main`
- **Feature branches**: Suporte experimental (Labs → GitHub Branch Switching)
- Sem PR obrigatório atualmente (fluxo Lovable-first)

---

## Golden Path de Release

Fluxo obrigatório antes de qualquer Publish para Produção.

### Pré-requisitos

1. Todas as alterações commitadas no editor
2. Nenhum erro de runtime visível no preview

### Quality Gates (obrigatórios)

| # | Gate | Comando / Ação | Critério de Aprovação | Bloqueante? |
|---|------|----------------|----------------------|-------------|
| 1 | **Lint** | `npm run lint` | Zero erros (warnings aceitos) | ✅ Sim |
| 2 | **Testes** | `npm run test` | 100% dos testes passando | ✅ Sim |
| 3 | **Build** | `npm run build` | Build sem erros | ✅ Sim |
| 4 | **Scan de segredos** | `grep -rn "sk_live\|secret_key\|password=" src/` | Zero matches | ✅ Sim |
| 5 | **Scan de dependências** | `npm audit --production` | Zero vulnerabilidades críticas/altas | ⚠️ Avaliação |
| 6 | **Security scan** | Lovable Security Scan | Zero achados P0 | ✅ Sim |
| 7 | **Smoke test manual** | Testar fluxos críticos no preview | Auth + CRUD imóveis + CRM ok | ✅ Sim |

### Smoke Tests Obrigatórios (Gate 7)

Antes de cada release, validar manualmente no ambiente Test:

- [ ] **Auth**: Login com credenciais válidas → dashboard carrega
- [ ] **Auth negativo**: Login com senha errada → mensagem de erro
- [ ] **Imóveis**: Listar imóveis → cards renderizam
- [ ] **Imóvel detalhe**: Abrir detalhe → dados carregam
- [ ] **CRM**: Abrir Kanban → colunas e leads visíveis
- [ ] **Mobile**: Testar em viewport mobile → layout responsivo ok
- [ ] **Edge Functions**: Billing/import endpoints respondem (não 500)

### Processo de Publicação

```
1. Executar Quality Gates 1-6
   ↓ Todos passam?
   ├── NÃO → Corrigir e re-executar
   └── SIM ↓
2. Executar Smoke Tests (Gate 7) no preview
   ↓ Todos passam?
   ├── NÃO → Corrigir e re-executar
   └── SIM ↓
3. Preencher checklist GO/NO-GO abaixo
   ↓ Decisão = GO?
   ├── NÃO → Documentar bloqueio, corrigir
   └── SIM ↓
4. Share → Publish no Lovable Editor
   ↓
5. Validar smoke tests em Produção (30 min)
   ↓
6. Monitorar logs de erro por 2h
```

---

## Checklist GO / NO-GO

Preencher antes de cada Publish para Produção:

### Qualidade Técnica
- [ ] Build local passa sem erros
- [ ] Lint passa sem erros
- [ ] Todos os testes passam
- [ ] Nenhum segredo hardcoded no código

### Segurança
- [ ] Edge Functions sensíveis exigem autenticação (getClaims)
- [ ] CORS revisado (sem wildcard em produção para funções admin)
- [ ] RLS policies ativas em todas as tabelas com dados de usuário
- [ ] Security scan sem achados P0

### Funcional
- [ ] Smoke tests dos fluxos críticos passam
- [ ] Sem regressões visuais em mobile
- [ ] Edge Functions respondendo (billing, import, etc.)

### Operacional
- [ ] Plano de rollback conhecido (Version History → Restaurar → Publish)
- [ ] Schema destrutivo? Verificar dados em Live antes
- [ ] Versão anterior identificada para rollback rápido

### Decisão

| Critério | Status |
|----------|--------|
| Gates obrigatórios | ☐ OK / ☐ FALHA |
| Smoke tests | ☐ OK / ☐ FALHA |
| Riscos residuais documentados | ☐ SIM / ☐ NÃO |
| **Decisão** | ☐ **GO** / ☐ **NO-GO** / ☐ **GO com restrições** |

---

## Rollback

### Procedimento Padrão
1. **Código**: No Lovable Editor → Version History → Restaurar versão anterior → Publish
2. **Schema destrutivo**: Antes de publicar migrações que removem colunas/tabelas, verificar dados em Live via Cloud View → Run SQL
3. **Emergência**: Restaurar versão anterior no editor e republicar

### Tempo estimado de rollback
- Código: ~2 minutos (restaurar + publish)
- Schema: variável (requer avaliação de dados)

---

## Incidentes

### Severidade

| Nível | Descrição | SLA | Ação |
|-------|-----------|-----|------|
| SEV-1 / P0 | App inacessível / dados corrompidos / segurança crítica | Imediato | Rollback + fix |
| SEV-2 / P1 | Feature core quebrada (auth, CRUD imóveis) | < 2h | Fix prioritário |
| SEV-3 / P2 | Feature secundária com bug | < 24h | Backlog priorizado |
| SEV-4 / P3 | Cosmético / melhoria | Backlog | Próximo ciclo |

### Procedimento de Incidente
1. **Identificar**: Verificar logs (Console, Edge Function logs, DB logs)
2. **Conter**: Se necessário, rollback via version history
3. **Corrigir**: Aplicar fix no editor
4. **Verificar**: Testar no ambiente Test
5. **Publicar**: Deploy da correção (seguir quality gates — fast-track para SEV-1)
6. **Post-mortem**: Documentar causa e prevenção

### Fast-track para SEV-1
Em emergências SEV-1, os gates mínimos são:
- Build passa
- Fix não introduz regressão óbvia
- Teste manual do fluxo afetado

---

## Backup

- **Banco de dados**: Backups automáticos gerenciados pelo Lovable Cloud
- **Código**: Versionado no GitHub (sync bidirecional)
- **Imagens**: Cloudinary + R2 fallback (ver CONTINGENCY_PLAN.md)

## Monitoramento

- Edge Function logs: acessíveis via Lovable Cloud View
- DB logs: via analytics queries
- Storage: dashboard de auditoria em `/admin/auditoria`
- Erros de frontend: console do preview / browser DevTools
