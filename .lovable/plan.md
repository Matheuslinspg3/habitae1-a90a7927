

# Plano: Integrar Interacoes do Lead com a Agenda

## Objetivo
Quando o usuario registrar uma interacao no CRM (ligacao, visita, reuniao, etc.), ela aparecera automaticamente na Agenda. Da mesma forma, ao criar um compromisso na Agenda vinculado a um lead, sera possivel registra-lo como interacao na timeline do lead.

## Como vai funcionar

**Fluxo 1 -- Da interacao para a agenda:**
Ao registrar uma interacao no CRM (ex: "Ligar para Joao dia 25"), o sistema cria automaticamente um compromisso na tabela `appointments` vinculado ao lead correspondente. Interacoes passadas tambem aparecerao na agenda no dia em que ocorreram.

**Fluxo 2 -- Da agenda para a interacao:**
Ao concluir um compromisso na agenda que tem lead vinculado, o sistema oferece a opcao de registrar essa atividade como interacao na timeline do lead.

**Visualizacao unificada:**
Na pagina de Agenda, alem dos compromissos normais, as interacoes registradas do lead aparecerao como itens visuais no calendario, com icones e cores diferenciados por tipo (ligacao, visita, etc.).

---

## Detalhes Tecnicos

### 1. Banco de dados -- nova coluna de vinculo

Adicionar coluna `interaction_id` na tabela `appointments` (opcional, nullable) para vincular um compromisso a uma interacao existente. E adicionar coluna `appointment_id` na tabela `lead_interactions` para o vinculo reverso.

```sql
ALTER TABLE appointments ADD COLUMN interaction_id uuid REFERENCES lead_interactions(id) ON DELETE SET NULL;
ALTER TABLE lead_interactions ADD COLUMN appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;
```

### 2. Formulario de interacao -- opcao "Agendar na agenda"

No componente `LeadInteractionTimeline.tsx`, adicionar um toggle/checkbox "Incluir na agenda" ao registrar uma interacao. Quando ativado:
- Se a data da interacao for futura: cria um `appointment` automaticamente com titulo baseado no tipo (ex: "Ligacao - Joao Silva") e vincula o `lead_id`.
- Se a data for passada: cria o appointment como ja concluido (`completed: true`).
- Salva o `appointment_id` na interacao e o `interaction_id` no appointment.

### 3. Hook `useLeadInteractions` -- logica de criacao conjunta

Atualizar o `createInteraction` para aceitar o flag `addToSchedule`. Quando verdadeiro:
1. Criar a interacao na `lead_interactions`.
2. Criar o appointment na `appointments` com os dados derivados.
3. Atualizar ambos com os IDs cruzados.

### 4. Pagina de Agenda -- exibir interacoes

No `Schedule.tsx` e `AppointmentCard.tsx`:
- Appointments que possuem `interaction_id` mostrarao um badge indicando o tipo de interacao (ex: icone de telefone para ligacao).
- O card tera um link "Ver no CRM" que abre o LeadDetails correspondente.

### 5. Acao "Registrar como interacao" na Agenda

No `AppointmentCard.tsx`, quando o compromisso tem `lead_id` mas nao tem `interaction_id`, exibir opcao no menu "Registrar como interacao" que:
- Abre um mini-formulario para selecionar o tipo de interacao.
- Cria a `lead_interaction` vinculada.

### 6. Formulario de compromisso -- campo tipo de interacao

No `AppointmentForm.tsx`, quando um lead esta selecionado, exibir opcao "Registrar como interacao do lead" com select do tipo. Ao salvar, cria ambos os registros vinculados.

---

## Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| Migration SQL (nova) | Adicionar colunas `interaction_id` e `appointment_id` |
| `src/hooks/useLeadInteractions.ts` | Logica de criacao conjunta com appointment |
| `src/components/crm/LeadInteractionTimeline.tsx` | Toggle "Incluir na agenda" no formulario |
| `src/components/schedule/AppointmentCard.tsx` | Badge de tipo de interacao + acao "Registrar como interacao" |
| `src/components/schedule/AppointmentForm.tsx` | Campo opcional "Registrar como interacao" quando lead selecionado |
| `src/pages/Schedule.tsx` | Nenhuma mudanca estrutural (dados vem do mesmo hook) |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente apos migration |

