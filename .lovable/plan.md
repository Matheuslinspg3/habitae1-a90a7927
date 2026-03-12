

# Plano: Geração de Imagem para Anúncios via Stable Diffusion (VPS)

## Resumo

Adicionar ao Gerador de Anúncios a capacidade de gerar **uma imagem** de anúncio imobiliário usando Stable Diffusion rodando na VPS do usuário. O fluxo: puxar imagens do imóvel selecionado (ou permitir upload manual), enviar como referência para a API do Stable Diffusion, e exibir a imagem gerada junto aos textos.

## Sobre Stable Diffusion na VPS

Para geração de imagens local, as melhores opções são:

- **ComfyUI** — Interface node-based, muito flexível, API REST nativa. Ideal para workflows customizados.
- **Automatic1111 (AUTOMATIC1111/stable-diffusion-webui)** — Interface web clássica, API REST simples (`/sdapi/v1/txt2img`, `/sdapi/v1/img2img`). Mais fácil de configurar.
- **Forge (lllyasviel/stable-diffusion-webui-forge)** — Fork otimizado do A1111, melhor performance em GPUs com menos VRAM.

**Requisitos da VPS**: GPU com mín. 8GB VRAM (ex: RTX 3060/4060), CUDA, Python 3.10+. Para rodar sem GPU: modelos menores como SDXL Turbo, mas qualidade inferior.

**Recomendação**: Automatic1111 com flag `--api --listen --cors-allow-origins=*` é o setup mais simples.

## Etapas de Implementação

### 1. Adicionar variável de ambiente
- `VITE_SD_URL` no `.env.example` (ex: `http://YOUR-VPS-IP:7860`)

### 2. Buscar imagens do imóvel selecionado
- Quando o usuário seleciona um imóvel, carregar as `property_images` associadas
- Exibir as imagens em um seletor horizontal para o usuário escolher qual usar como base
- Adicionar também opção de upload manual de imagem

### 3. Seção de geração de imagem na página
- Novo card "Imagem do Anúncio" com:
  - Seletor de imagem do imóvel (thumbnails clicáveis) ou botão upload
  - Botão "Gerar Imagem"
  - Preview da imagem gerada
  - Botão "Baixar" para salvar

### 4. Integração com API do Stable Diffusion
- Usar endpoint `POST /sdapi/v1/img2img` (se imagem base) ou `/sdapi/v1/txt2img` (sem imagem)
- Prompt automático baseado nos dados do imóvel (ex: "professional real estate photo, modern apartment, bright living room...")
- A imagem base é enviada como base64
- Resposta retorna imagem em base64

### 5. Atualizar tabela `anuncios_gerados`
- Migração: adicionar coluna `imagem_url TEXT` na tabela
- Salvar imagem gerada (base64 ou upload para R2)

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/GeradorAnuncios.tsx` | Adicionar seletor de imagem + geração |
| `.env.example` | Adicionar `VITE_SD_URL` |
| Migração SQL | Adicionar coluna `imagem_url` |

## Detalhes Técnicos

A chamada para Stable Diffusion (Automatic1111 API):

```typescript
const response = await fetch(`${SD_URL}/sdapi/v1/img2img`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    init_images: [base64Image],
    prompt: "professional real estate advertisement...",
    steps: 20,
    cfg_scale: 7,
    denoising_strength: 0.5,
    width: 1024,
    height: 1024,
  }),
});
const data = await response.json();
const generatedImage = `data:image/png;base64,${data.images[0]}`;
```

