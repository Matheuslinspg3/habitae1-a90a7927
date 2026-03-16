

## Diagnóstico: RD Station nao puxa leads via API

Após análise completa do código, identifiquei o problema:

**A integração atual NÃO possui funcionalidade de puxar leads do RD Station via API.** Existem apenas dois mecanismos implementados:

1. **Webhook (passivo)** — recebe leads quando o RD Station envia via webhook configurado. Armazena em `rd_station_webhook_logs` e opcionalmente cria no CRM.
2. **Estatísticas (API)** — usa as chaves de API apenas para consultar métricas (funil, emails). Não importa leads.

Ou seja, mesmo com as chaves de API configuradas, nenhum lead é puxado automaticamente. Para que leads apareçam, seria necessário que o webhook estivesse configurado no lado do RD Station apontando para a URL gerada, OU que existisse uma função de sincronização ativa.

---

### Plano: Criar sincronização ativa de leads via API do RD Station

**1. Nova Edge Function `rd-station-sync-leads`**
- Autenticar o usuário e buscar as chaves de API da tabela `rd_station_settings`
- Chamar `GET https://api.rd.services/platform/contacts` com paginação
- Para cada contato retornado, verificar duplicata por email na tabela `leads`
- Se `auto_send_to_crm` estiver ativo, criar o lead no CRM
- Registrar cada lead processado em `rd_station_webhook_logs` com `event_type = 'api_sync'`
- Retornar resumo (criados, duplicados, erros)

**2. Botão "Sincronizar Leads" na interface**
- Adicionar um botão na aba de Configurações ou Estatísticas do RD Station
- Ao clicar, invocar a nova edge function
- Mostrar progresso e resultado (quantos leads importados/duplicados)

**3. Validações**
- Exigir que `api_private_key` esteja configurada
- Limitar sincronização a leads dos últimos 30 dias para evitar sobrecarga
- Respeitar deduplicação por email

### Detalhes Técnicos

```text
Fluxo:
  Botão "Sincronizar" 
    → supabase.functions.invoke("rd-station-sync-leads")
      → GET api.rd.services/platform/contacts?limit=100
      → Para cada contato:
         ├─ email existe em leads? → skip (duplicate)
         └─ não existe → INSERT leads + log em rd_station_webhook_logs
      → Retorna { created: N, duplicates: N, errors: N }
```

Arquivos a criar/modificar:
- `supabase/functions/rd-station-sync-leads/index.ts` (nova edge function)
- `src/components/ads/RDStationSettingsContent.tsx` (botão de sync)
- `supabase/config.toml` (registrar nova function com `verify_jwt = false`)

