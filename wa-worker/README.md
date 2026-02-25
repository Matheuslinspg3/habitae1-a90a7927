# wa-worker

Worker WhatsApp com Baileys 6+ e healthcheck HTTP para execução como **Web App** no Easypanel.

## Easypanel (Web App)

- Não configure uma porta manualmente no app.
- O processo usa automaticamente `process.env.PORT` (com fallback para `3000`).

## Variáveis obrigatórias

- `EDGE_BASE_URL`
- `WORKER_SECRET`
- `INSTANCE_ID`

## Rotas de health

- `GET /` → `wa-worker running`
- `GET /health` → `ok`
