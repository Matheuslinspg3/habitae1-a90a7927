

# Plano: Gerador de Anúncios com IA (Ollama)

## Resumo
Criar uma nova página `/gerador-anuncios` com formulário de dados do imóvel, que gera 3 versões de texto (Portal, Instagram, WhatsApp) via chamadas diretas ao Ollama na VPS do usuário, e salva os resultados no banco.

## Etapas

### 1. Criar tabela `anuncios_gerados`
Migração SQL:
```sql
CREATE TABLE public.anuncios_gerados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  corretor_id UUID NOT NULL,
  texto_portal TEXT,
  texto_instagram TEXT,
  texto_whatsapp TEXT,
  dados_formulario JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.anuncios_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own org anuncios"
  ON public.anuncios_gerados FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own org anuncios"
  ON public.anuncios_gerados FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));
```

### 2. Criar página `src/pages/GeradorAnuncios.tsx`
- Formulário com os campos solicitados (tipo imóvel, finalidade, bairro/cidade, valor, metragem, quartos/suítes/vagas, diferenciais)
- Botão "Gerar Anúncios" que dispara `Promise.all` com 3 fetches para `VITE_OLLAMA_URL + "/api/generate"`
- Cada fetch usa prompt diferente (Portal, Instagram, WhatsApp)
- Skeleton loading nos cards de resultado
- Cards com `<Textarea>` editável + botão "Copiar" (clipboard API)
- Ao receber respostas, salva na tabela `anuncios_gerados` via Supabase client

### 3. Registrar rota e navegação
- **`src/App.tsx`**: Adicionar rota `/gerador-anuncios` dentro do layout protegido
- **`src/components/AppSidebar.tsx`**: Adicionar item no menu (ícone `Sparkles` ou `Wand2`)
- **`src/components/MobileBottomNav.tsx`**: Avaliar se cabe, ou acessar pelo sidebar

### 4. Variável de ambiente
- `VITE_OLLAMA_URL` referenciada via `import.meta.env.VITE_OLLAMA_URL`
- Valor padrão no `.env.example` com comentário explicativo

## Detalhes dos prompts Ollama

Cada chamada terá body:
```json
{
  "model": "llama3",
  "stream": false,
  "prompt": "<prompt específico com dados do formulário>"
}
```

Os 3 prompts serão montados dinamicamente com os dados do formulário, instruindo o modelo sobre formato, tom e limite de palavras de cada versão.

## Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/pages/GeradorAnuncios.tsx` | Criar |
| `src/App.tsx` | Adicionar rota lazy |
| `src/components/AppSidebar.tsx` | Adicionar item menu |
| `.env.example` | Adicionar `VITE_OLLAMA_URL` |
| Migração SQL | Criar tabela + RLS |

