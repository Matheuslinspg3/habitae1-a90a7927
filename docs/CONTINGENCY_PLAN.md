# Plano de Contingência - Habitae

Este documento descreve as estratégias para manter o sistema gratuito caso as APIs ou armazenamento atinjam seus limites.

## Monitoramento de Uso

### Dashboard de Auditoria
Acesse `/admin/auditoria` (apenas admin) para monitorar:
- Uso de storage do Cloudinary
- Bandwidth consumido
- Contagem de registros por tabela
- Saúde geral do sistema

### Alertas Automáticos
| Uso | Nível | Ação |
|-----|-------|------|
| 70% | Informativo | Mostrar banner no dashboard |
| 85% | Aviso | Email + notificação in-app |
| 95% | Crítico | Bloquear novos uploads + alerta urgente |

---

## Nível 1: Prevenção (Antes de Lotar)

### Otimização de Imagens (Cloudinary)
```
# Transformações automáticas
q_auto,f_auto,w_1920 # Qualidade e formato automáticos, max 1920px
```

Benefício: ~50% redução de storage

### Thumbnails para Listagens
- Gerar versões pequenas (400x300) para cards
- Usar versão original apenas no detalhe

### Deduplicação de Assets
- Hash SHA256 antes de upload
- Verificar se já existe antes de subir
- Reutilizar URL existente

Benefício: ~20% redução de storage

### Limpeza de Órfãos
Executar rotina semanal:
```sql
DELETE FROM property_images 
WHERE property_id NOT IN (SELECT id FROM properties);
```

### Compressão de Dados
- Arquivar leads inativos > 1 ano
- Mover para tabela `leads_archive`

---

## Nível 2: Contenção (Perto do Limite)

### Migração para Storage Alternativo

#### Opção A: Cloudflare R2
- **Custo**: Gratuito até 10GB/mês
- **Egress**: Gratuito
- **Prós**: Zero egress fee, CDN integrado
- **Contras**: Setup inicial

#### Opção B: Backblaze B2
- **Custo**: Gratuito até 10GB
- **Egress**: Gratuito via Cloudflare
- **Prós**: Barato, confiável
- **Contras**: Precisa de CDN front

#### Opção C: Supabase Storage
- **Custo**: Incluso no plano
- **Prós**: Já integrado
- **Contras**: Limite de 1GB (free tier)

### Implementação de Fallback
```typescript
async function uploadImage(file: File) {
  const usage = await getCloudinaryUsage();
  
  if (usage.percentage < 90) {
    return uploadToCloudinary(file);
  }
  
  // Fallback para R2
  return uploadToR2(file);
}
```

### CDN e Cache Agressivo
- Cache de imagens por 1 ano
- Invalidar apenas quando necessário
- Usar headers `Cache-Control: max-age=31536000`

### Rate Limiting
- Máximo 50 uploads/dia por organização (free tier)
- Sem limite para planos pagos

---

## Nível 3: Arquitetura Alternativa (Lotou)

### Separação de Concerns
```
ANTES:
┌─────────────┐     ┌─────────────┐
│ Supabase DB │ <-> │ Cloudinary  │
│ (500 MB)    │     │ (25 GB)     │
└─────────────┘     └─────────────┘

DEPOIS:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Supabase DB │ <-> │ Cloudflare  │ <-> │ Backblaze   │
│ (Core only) │     │ R2 (hot)    │     │ B2 (cold)   │
│ ~100 MB     │     │ Free tier   │     │ ~$5/TB      │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Multi-Storage com Fallback
```typescript
const storageProviders = [
  { name: 'cloudinary', check: () => cloudinaryUsage < 95 },
  { name: 'r2', check: () => r2Usage < 95 },
  { name: 'b2', check: () => true }, // sempre disponível
];

async function upload(file: File) {
  for (const provider of storageProviders) {
    if (provider.check()) {
      return uploadTo(provider.name, file);
    }
  }
  throw new Error('Todos os storages lotados');
}
```

### Logs para Sistema Externo
- Mover `marketplace_contact_access` antigos (>30d) para:
  - ClickHouse (free tier)
  - BigQuery (free tier: 10GB/mês)
  - Ou simplesmente deletar se não for crítico

### Modo Comunitário Gratuito
Para organizações no plano gratuito:
- Limite de 50 imóveis
- Limite de 200 leads
- Imagens comprimidas automaticamente
- Fila de processamento para IA (cache longo)

---

## Checklist de Migração

### Preparação
- [ ] Criar conta Cloudflare R2 ou Backblaze B2
- [ ] Configurar bucket e políticas de acesso
- [ ] Testar upload/download programaticamente

### Implementação
- [ ] Criar Edge Function de upload multi-provider
- [ ] Implementar proxy/CDN para URLs estáveis
- [ ] Migrar 100 imagens como teste
- [ ] Validar que URLs antigas funcionam

### Migração Completa
- [ ] Executar script de migração em lotes (noite/fim de semana)
- [ ] Atualizar referências no banco de dados
- [ ] Manter URLs antigas via redirect
- [ ] Monitorar erros por 1 semana

### Finalização
- [ ] Verificar 100% das imagens acessíveis
- [ ] Remover assets antigos do Cloudinary
- [ ] Documentar novo fluxo

---

## Estimativas de Impacto

### Cloudinary Free Tier
- Storage: 25 GB
- Bandwidth: 25 GB/mês
- Transformações: 25.000/mês

### Uso Estimado por Imóvel
- ~10 fotos x 500KB = 5MB/imóvel
- Thumbnails: +1MB/imóvel
- **Total**: ~6MB/imóvel

### Capacidade Estimada
- Cloudinary: ~4.000 imóveis
- Com compressão: ~8.000 imóveis
- Com R2 fallback: ilimitado*

---

## Contatos e Recursos

- **Cloudinary Docs**: https://cloudinary.com/documentation
- **Cloudflare R2**: https://developers.cloudflare.com/r2/
- **Backblaze B2**: https://www.backblaze.com/b2/docs/

---

*Última atualização: Janeiro 2026*
