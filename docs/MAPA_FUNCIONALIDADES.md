# Mapa Completo de Funcionalidades — Porta do Corretor

> Atualizado em: 2026-03-14

---

## 📊 1. Dashboard (`/dashboard`)
**Acesso:** Todos os usuários autenticados

| Elemento | Descrição |
|---|---|
| **Boas-vindas** | Saudação personalizada com nome do usuário |
| **Cards de Resumo** | Imóveis ativos, Leads ativos (novos na semana), Contratos ativos/pendentes, Saldo financeiro |
| **Ações Rápidas** | Botões para criar imóvel, lead, contrato, agendar visita |
| **Tarefas do Dia** | Lista de tarefas pendentes para hoje |
| **Compromissos Próximos** | Agenda de visitas e reuniões futuras |
| **Resumo do Pipeline** | Distribuição de leads por estágio do funil |
| **Funil de Conversão** | Visualização gráfica do funil CRM |
| **Atividades Recentes** | Últimas ações registradas na organização |
| **Alertas de Inatividade** | Leads e imóveis sem interação recente |
| **Imóveis Desatualizados** | Alerta de imóveis sem atualização há muito tempo |
| **Métricas do Marketplace** | Visualizações e contatos dos imóveis publicados |
| **Banner PWA** | Sugestão de instalação do app |

---

## 🏠 2. Imóveis (`/imoveis`)
**Acesso:** Todos | **Tela única com filtros e views**

| Função | Descrição |
|---|---|
| **Cadastro de Imóvel** | Formulário completo com abas: Básico, Valores, Localização, Características, Descrição, Fotos |
| **Busca Unificada** | Busca por código, título, bairro, cidade |
| **Filtros Avançados** | Tipo, status, faixa de preço, quartos, área, bairro |
| **Modos de Visualização** | Cards, Lista, Mapa |
| **Seleção em Massa** | Selecionar múltiplos e aplicar ações: publicar no marketplace, excluir, alterar status |
| **Import via PDF** | Extração automática de dados de imóvel a partir de PDF |
| **Busca Salvas** | Salvar e reutilizar filtros frequentes |
| **QR Code** | Gerar QR Code para landing page do imóvel |
| **Landing Page** | Página pública personalizada por imóvel com editor visual |
| **Detalhes do Imóvel** (`/imoveis/:id`) | Galeria, dados completos, histórico, publicação marketplace, compartilhar link |
| **Detecção de Duplicatas** | Identificação automática de imóveis duplicados na criação |
| **Status por Cores** | Disponível, Reservado, Com Proposta, Vendido, Alugado, Inativo |

---

## 👤 3. Proprietários (`/proprietarios`)
**Acesso:** Todos

| Função | Descrição |
|---|---|
| **Cadastro** | Nome, CPF/CNPJ, telefone, email, endereço |
| **Tabela com busca** | Lista paginada com filtro por nome |
| **Seleção em massa** | Excluir múltiplos proprietários |
| **Detalhes** | Drawer com dados completos e imóveis vinculados |
| **Aliases** | Nomes alternativos para matching na importação |
| **Cards de resumo** | Total, com imóveis, sem imóveis |

---

## 🏪 4. Marketplace (`/marketplace`)
**Acesso:** Todos

| Função | Descrição |
|---|---|
| **Vitrine de Imóveis** | Imóveis publicados por todas as imobiliárias da plataforma |
| **Filtros** | Tipo de transação, tipo de imóvel, faixa de preço, quartos, cidade, bairro, amenidades |
| **Card de Imóvel** | Fotos, preço, localização, características principais |
| **Contato** | Dialog para entrar em contato com o corretor responsável |
| **Detalhes** (`/marketplace/:id`) | Galeria completa, mapa, dados detalhados, contato |

---

## 👥 5. CRM (`/crm`)
**Acesso:** Todos (corretor vê apenas seus leads)

| Aba | Conteúdo |
|---|---|
| **Leads Ativos** | Kanban board com drag-and-drop por estágio do funil |
| **Leads Inativos** | Lista de leads desativados com opção de reativar |

**Dentro de cada Lead:**
- Detalhes completos (nome, telefone, email, origem, temperatura)
- Timeline de interações (ligações, emails, visitas, WhatsApp)
- Imóveis sugeridos automaticamente
- Atribuição a corretor
- Ações rápidas (WhatsApp, ligar, email)
- Formulário de nova interação
- Importação de leads (CSV, API, Imobzi)

---

## 📄 6. Contratos (`/contratos`)
**Acesso:** Todos

| Função | Descrição |
|---|---|
| **Lista/Tabela** | Contratos com filtros por status e tipo |
| **Cadastro** | Tipo (venda/locação), valor, datas, lead, imóvel, corretor |
| **Detalhes** | Drawer com dados completos, documentos anexados |
| **Filtros** | Status (rascunho, ativo, encerrado, cancelado), tipo |
| **IA** | Preenchimento automático de campos via IA |
| **Mobile** | Cards adaptados para telas menores |

---

## 💰 7. Financeiro (`/financeiro`)
**Acesso:** Todos

| Aba | Conteúdo |
|---|---|
| **Transações** | Receitas e despesas com categorias, gráfico de fluxo de caixa |
| **Faturas** | Cobranças geradas, status (pendente, paga, vencida) |
| **Comissões** | Comissões por contrato/corretor, status de pagamento |

**Resumo no topo:** Receita total, Despesa total, Saldo, Faturas pendentes

---

## 📅 8. Agenda (`/agenda`)
**Acesso:** Todos

| Aba | Conteúdo |
|---|---|
| **Compromissos** | Visitas, reuniões com calendário visual e lista |
| **Tarefas** | To-do list com status (pendente, concluída), prioridade |

**Funções:** Criar/editar/excluir, vincular a lead/imóvel, exportar .ics

---

## 📢 9. Meta Ads (`/anuncios`)
**Acesso:** Todos

| Aba | Conteúdo |
|---|---|
| **Anúncios** | Lista de campanhas/anúncios sincronizados do Meta Ads |
| **Leads** | Inbox de leads capturados pelos anúncios, envio para CRM |
| **Estatísticas** | CPL, CPC, CTR, impressões, cliques, gastos por período |
| **Configurações** | Conexão OAuth Meta, conta de anúncios, auto-envio para CRM |

**Detalhe do Anúncio** (`/anuncios/ad/:id`): Métricas individuais + leads daquele anúncio

---

## 📊 10. RD Station (`/rdstation`)
**Acesso:** Todos

| Aba | Conteúdo |
|---|---|
| **Configurações** | Dados da integração RD Station |
| **Webhook** | URL e configuração do webhook de leads |
| **Sincronização (OAuth)** | Conexão OAuth e sync de contatos |
| **Estatísticas** | Métricas de leads recebidos via RD |

---

## ✨ 11. Gerador IA (`/gerador-anuncios`)
**Acesso:** Todos

| Função | Descrição |
|---|---|
| **Formulário** | Selecionar imóvel ou preencher dados manualmente (tipo, bairro, valor, etc.) |
| **Geração de Texto** | Textos para Portal, Instagram e WhatsApp via IA |
| **Geração de Imagem** | Imagem do anúncio via IA |
| **Copiar/Baixar** | Copiar textos individualmente, baixar imagem |

---

## ⚡ 12. Automações (`/automacoes`)
**Acesso:** Developer, Leader

| Aba | Conteúdo |
|---|---|
| **Dashboard** | Visão geral: automações ativas, execuções recentes |
| **Minhas Automações** | Lista com toggle ativar/desativar, duplicar, excluir |
| **Templates** | Modelos prontos para criar automações rapidamente |
| **Estatísticas** | Execuções por período, taxa de sucesso |
| **Histórico** | Log detalhado de cada execução |
| **Lead Score** | Configuração de pontuação automática de leads |

**Wizard:** Criar automação passo a passo (trigger → condição → ação)

---

## 📈 13. Atividades (`/atividades`)
**Acesso:** Admin+

| Função | Descrição |
|---|---|
| **Log de Ações** | Feed cronológico de todas as ações na organização |
| **Filtros** | Por corretor, tipo de entidade (lead, imóvel, contrato), tipo de ação |
| **Busca** | Buscar por nome de entidade |
| **Cards por ação** | Ícones e cores por tipo (criação, edição, exclusão, atribuição) |

---

## 🏢 14. Administração (`/administracao`)
**Acesso:** Admin+

| Aba | Conteúdo |
|---|---|
| **Dashboard de Equipe** | Membros com métricas: último login, ações em 30 dias, leads, imóveis, contratos. Botão remover membro |
| **Leads** | Distribuir leads sem corretor atribuído |
| **Cargos** | Criar cargos personalizados com permissões por módulo (CRM, Financeiro, etc.) |
| **Histórico** | Registro de entradas e saídas de membros da organização |

---

## 🔌 15. Integrações (`/integracoes`)
**Acesso:** Admin+

| Seção | Conteúdo |
|---|---|
| **Imobzi** | Configurar API key, iniciar importação, modo de sync |
| **Portais XML** | Feeds XML para portais imobiliários (ZAP, OLX, VivaReal) |
| **Histórico de Sync** | Tabela de importações realizadas com status e contadores |

---

## ⚙️ 16. Configurações (`/configuracoes`)
**Acesso:** Todos (abas variam por cargo)

| Aba | Acesso | Conteúdo |
|---|---|---|
| **Perfil** | Todos | Nome, telefone, email, CRECI, avatar, alterar senha |
| **Empresa** | Todos (edição: admin+) | Nome, CNPJ, telefone, email, endereço, logo |
| **Equipe** | Admin+ | Lista de membros, alterar cargos, convidar por link/email |
| **Aparência** | Todos | Tema (claro/escuro/sistema) |
| **Plano** | Todos | Detalhes da assinatura, upgrade, histórico de pagamentos |
| **Histórico** | Admin+ | Changelog de versões do sistema |
| **Clientes** | Developer/Leader | Convite de novos clientes para a plataforma |
| **Suporte** | Todos | Tickets de suporte, reportar problemas |

---

## 🔧 17. Developer (`/developer`)
**Acesso:** Developer only

| Aba | Conteúdo |
|---|---|
| **Uso por Org** | Métricas de uso por organização |
| **Storage** | Uso de armazenamento por organização |
| **Banco** | Exportação e métricas do banco de dados |
| **Importações** | Histórico global de importações |
| **Roles** | Gestão de cargos de todos os usuários |
| **Usuários** | Lista global, excluir usuário, resetar senha |
| **Assinaturas** | Gestão de planos e assinaturas |
| **Tickets** | Todos os tickets de suporte |
| **IA** | Dashboard de uso de IA, logs, configuração de providers |

**Cards extras:** System Health, Push Test, Purge Cache, PWA Diagnostics, Maintenance Mode

---

## 🔒 Controle de Acesso por Cargo

| Módulo | Developer | Admin | Sub-Admin | Leader | Corretor | Assistente |
|---|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (leitura) |
| Imóveis | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Proprietários | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Marketplace | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CRM | ✅ | ✅ | ✅ | ✅ | ✅ (só seus) | 👁️ |
| Contratos | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Financeiro | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Agenda | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Meta Ads | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| RD Station | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Gerador IA | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Automações | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Atividades | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Administração | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Integrações | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configurações | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Developer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📱 Navegação Atual (Sidebar)

### Problemas Identificados:
1. **6 grupos no menu** — excesso de seções visuais confusas
2. **"Anúncios"** é um grupo com 4 itens (Meta Ads, RD Station, Gerador IA, Google Ads disabled) — deveria ser subseção
3. **"Gestão"** contém apenas Atividades + Administração — pouco conteúdo para um grupo
4. **"Sistema"** mistura Integrações (admin) com Configurações (todos)
5. **Automações** fica isolada em grupo próprio com 1 item
6. **Inconsistência:** Configurações tem aba "Equipe" duplicando Administração → Equipe

### Estrutura Atual:
```
Menu Principal: Dashboard, Imóveis, Proprietários, Marketplace, CRM, Contratos, Financeiro, Agenda
Anúncios: Meta Ads, RD Station, Gerador IA, Google Ads (em breve)
Automações: Automações
Gestão: Atividades, Administração
Sistema: Integrações, Configurações
Developer: Developer
```

### Proposta de Reorganização:
```
Operacional: Dashboard, Imóveis, Proprietários, CRM, Agenda
Negócios: Marketplace, Contratos, Financeiro
Marketing: Meta Ads, RD Station, Gerador IA, Automações
Gestão: Administração, Atividades, Integrações
Sistema: Configurações
Developer: Developer (dev only)
```
