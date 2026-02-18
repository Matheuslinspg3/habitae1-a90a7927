

# Envio Automatico de Email de Convite

## Situacao Atual

- Ao criar convites (de cliente ou de equipe), o sistema apenas gera o link e copia para a area de transferencia.
- Nao existe envio automatico de email -- o administrador precisa copiar e enviar manualmente.
- Nao ha nenhum servico de email configurado no projeto.

## Proposta

Integrar o servico **Resend** para enviar emails automaticamente ao criar convites, tanto para novos clientes (imobiliarias) quanto para corretores entrando em uma equipe.

## Etapas

### 1. Configurar a chave API do Resend

- Solicitar ao usuario a chave de API do Resend (obtida em https://resend.com/api-keys).
- Armazena-la como secret `RESEND_API_KEY` na Lovable Cloud.
- O Resend oferece plano gratuito com 100 emails/dia, suficiente para convites.

### 2. Criar Edge Function `send-invite-email`

Uma unica funcao backend que recebe os dados do convite e envia o email formatado. Parametros:

- `to` -- email do destinatario
- `type` -- `"platform"` (novo cliente) ou `"team"` (corretor)
- `invite_link` -- URL completa do convite
- `org_name` -- nome da organizacao (para convite de equipe)
- `org_code` -- codigo da imobiliaria (para convite de equipe)
- `inviter_name` -- nome de quem convidou

A funcao monta um email HTML com template profissional contendo:

- Para convites de **cliente (plataforma)**: titulo "Voce foi convidado para a Habitae", botao com link de cadastro, mencao dos 7 dias gratuitos.
- Para convites de **equipe (corretor)**: titulo "Voce foi convidado para [Nome da Imobiliaria]", botao com link de cadastro, codigo da imobiliaria em destaque.

### 3. Atualizar `TeamInviteSection.tsx`

Apos criar o convite com sucesso no banco:

- Chamar `supabase.functions.invoke("send-invite-email")` com `type: "team"`, incluindo o link, nome da org e codigo da imobiliaria.
- Exibir toast de sucesso: "Convite enviado por email para [email]".
- Manter a opcao de copiar link manualmente como fallback.

### 4. Atualizar `PlatformInviteSection.tsx`

Apos criar o convite com sucesso:

- Chamar `supabase.functions.invoke("send-invite-email")` com `type: "platform"`, incluindo o link.
- Exibir toast: "Email de convite enviado para [email]".
- Manter opcao de copiar link como antes.

### 5. Template do Email

Ambos os templates incluem:

- Logo da Habitae (ou texto estilizado)
- Saudacao personalizada
- Explicacao clara do convite
- Botao de acao (CTA) com o link
- Para convite de equipe: caixa destacada com o codigo da imobiliaria
- Rodape com informacao de expiracao

---

## Secao Tecnica

### Edge Function `send-invite-email/index.ts`

```text
POST /send-invite-email
Body: { to, type, invite_link, org_name?, org_code?, inviter_name? }

1. Validar campos obrigatorios
2. Montar HTML do email baseado no type
3. Chamar Resend API:
   POST https://api.resend.com/emails
   Headers: Authorization: Bearer RESEND_API_KEY
   Body: { from: "Habitae <noreply@seudominio.com>", to, subject, html }
4. Retornar sucesso/erro
```

### Mudancas nos componentes

- `TeamInviteSection.tsx` -- adicionar chamada `send-invite-email` no `onSuccess` da mutation `createInvite`
- `PlatformInviteSection.tsx` -- adicionar chamada `send-invite-email` no `onSuccess` da mutation `createInvite`

### Pre-requisitos

- Conta no Resend (gratuita)
- Chave API do Resend configurada como secret
- Dominio verificado no Resend (ou usar `onboarding@resend.dev` para testes)

