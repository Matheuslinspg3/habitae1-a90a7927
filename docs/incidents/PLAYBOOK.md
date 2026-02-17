# Playbook de Incidentes — Habitae

---

## Papéis

| Papel | Responsabilidade |
|---|---|
| **IC** (Incident Commander) | Coordena resposta, decide escalonamento |
| **Comms** | Comunica status internamente e (se aplicável) externamente |
| **Scribe** | Registra timeline minuto a minuto |
| **Driver** | Executa ações técnicas (debugging, rollback, fix) |

---

## Cadência de comunicação

| Severidade | Frequência de update |
|---|---|
| SEV-1 | A cada 15 minutos |
| SEV-2 | A cada 30 minutos |
| SEV-3 | A cada 2 horas |

---

## Checklist por severidade

### SEV-1 (Crítico — app inacessível / dados / receita)
- [ ] IC designado
- [ ] Canal de comunicação aberto (chat/call)
- [ ] Scribe registrando timeline
- [ ] Diagnóstico inicial (logs, métricas, status page provedores)
- [ ] Mitigação imediata tentada (rollback / feature flag / restart)
- [ ] Comunicação interna enviada
- [ ] Comunicação externa (se aplicável)
- [ ] Resolução confirmada
- [ ] Postmortem agendado (até 5 dias úteis)

### SEV-2 (Feature core quebrada)
- [ ] Owner identificado
- [ ] Diagnóstico em andamento
- [ ] Mitigação aplicada ou fix deployado
- [ ] Comunicação enviada
- [ ] Postmortem agendado (até 10 dias úteis)

### SEV-3/SEV-4
- [ ] Issue criada no backlog
- [ ] Fix priorizado no próximo ciclo

---

## Modelo de comunicação interna

```
[SEV-X] Título do incidente
Status: Investigando / Mitigando / Resolvido
Impacto: [descrição objetiva]
Início: [timestamp]
Última atualização: [timestamp]
Próximo update: [timestamp]
Ações em curso: [o que está sendo feito]
```

---

## Critérios de encerramento

1. Serviço restaurado e funcionando normalmente.
2. Causa raiz identificada (mesmo que preliminar).
3. Timeline documentada.
4. Postmortem agendado com owner.
