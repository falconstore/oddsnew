

# Plano: Integração do Controle de Procedimentos (Supabase Secundário)

## Visão Geral

Migrar o sistema de "Controle de Procedimentos" do Shark ADM para o OddsCompare, conectando a um **Supabase secundário** apenas para dados. A autenticação permanece no Supabase principal do OddsCompare.

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE PRINCIPAL                      │
│                (OddsCompare - Autenticação)                 │
├─────────────────────────────────────────────────────────────┤
│  • auth.users, user_roles, user_profiles                    │
│  • Controle de quem é admin                                 │
│  • Liga, times, odds, etc.                                  │
└─────────────────────────────────────────────────────────────┘
               │
               │ Usuário logado como Admin?
               │         ↓ Sim
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE SECUNDÁRIO                      │
│                 (Shark ADM - Apenas Dados)                  │
├─────────────────────────────────────────────────────────────┤
│  • Tabela "procedures" (já existente)                       │
│  • Sem autenticação - acesso via Anon Key                   │
│  • Operações CRUD diretas                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Schema da Tabela (Já Existente)

| Coluna | Tipo | Obrigatório | Observação |
|--------|------|-------------|------------|
| id | uuid | Sim | PK com uuid_generate_v4() |
| created_date | timestamptz | Não | Default: now() |
| updated_date | timestamptz | Não | Default: now() |
| created_by | text | Não | Identificador do criador |
| date | date | Sim | Data do procedimento |
| procedure_number | text | Sim | Número identificador |
| platform | text | Sim | Casa de apostas |
| promotion_name | text | Não | Nome da promoção |
| category | text | Sim | Categoria do procedimento |
| status | text | Sim | Status atual |
| freebet_reference | text | Não | Referência freebet |
| freebet_value | numeric | Não | Valor do freebet |
| profit_loss | numeric | Sim | Lucro ou prejuízo |
| telegram_link | text | Não | Link do Telegram |
| dp | boolean | Não | Duplo Green |
| tags | text[] | Não | Array de tags |
| is_favorite | boolean | Não | Marcado como favorito |

---

## Fase 1: Configuração de Infraestrutura

### 1.1 Variáveis de Ambiente

Adicionar ao arquivo `.env`:

| Variável | Descrição |
|----------|-----------|
| VITE_PROCEDURES_SUPABASE_URL | URL do Supabase secundário |
| VITE_PROCEDURES_SUPABASE_ANON_KEY | Anon Key do Supabase secundário |

### 1.2 Criar Cliente Supabase Secundário

Criar `src/lib/supabaseProcedures.ts`:

- Importa createClient do @supabase/supabase-js
- Lê as variáveis VITE_PROCEDURES_*
- Exporta cliente dedicado para procedures
- Inclui validação para verificar se as credenciais existem

---

## Fase 2: Tipos TypeScript

### 2.1 Criar `src/types/procedures.ts`

Definir interfaces e tipos:

| Tipo | Descrição |
|------|-----------|
| ProcedureCategory | Union type: 'Promoção', 'Cashback', 'Freebet', 'Superodd', 'Extra', 'Ganhar Giros Gratis' |
| ProcedureStatus | Union type: 'Enviado', 'Concluído', 'Lucro Direto', 'Freebet Pendente', etc. |
| Procedure | Interface completa mapeando a tabela do banco |
| ProcedureFilters | Interface para filtros avançados |
| ProcedureFormData | Interface para dados do formulário (create/update) |

### 2.2 Atualizar `src/types/auth.ts`

- Adicionar `PROCEDURE_CONTROL: 'procedure_control'` ao objeto PAGE_KEYS
- Adicionar entrada correspondente no PAGE_CONFIG com label e adminOnly: true

---

## Fase 3: Hook de Dados

### 3.1 Criar `src/hooks/useProcedures.ts`

Hook baseado em React Query seguindo o padrão de `useOddsData.ts`:

| Hook/Função | Descrição |
|-------------|-----------|
| useProcedures(month?) | Lista procedures com filtro de mês opcional |
| useCreateProcedure | Mutation para criar novo procedure |
| useUpdateProcedure | Mutation para atualizar existente |
| useDeleteProcedure | Mutation para remover |
| useBulkCreateProcedures | Mutation para importação CSV em lote |
| useToggleFavorite | Mutation para marcar/desmarcar favorito |

Configuração do React Query:
- queryKey: ['procedures']
- staleTime: 5000 (5 segundos)
- refetchInterval: 10000 (10 segundos) para auto-refresh
- Invalidação automática após mutations

---

## Fase 4: Componentes

### 4.1 Estrutura de Arquivos

Criar diretório `src/components/procedures/`:

| Componente | Descrição | Baseado em |
|------------|-----------|------------|
| ProcedureStats.tsx | Cards de estatísticas | StatCard original |
| ProcedureFilters.tsx | Filtros avançados | ProcedureFilters.jsx |
| ProcedureTable.tsx | Tabela desktop | Tabela do ProcedureControl.jsx |
| ProcedureMobileCards.tsx | Cards responsivos mobile | Cards do ProcedureControl.jsx |
| ProcedureModal.tsx | Modal criar/editar | ProcedureModal.jsx |
| ImportModal.tsx | Importação CSV | ImportModal.jsx |
| ColumnCustomizer.tsx | Personalizar colunas | ColumnCustomizer.jsx |
| TagManager.tsx | Gerenciar tags | TagManager.jsx |
| NotificationPanel.tsx | Alertas urgentes | NotificationPanel.jsx |

### 4.2 Componentes de Gráficos

| Componente | Descrição |
|------------|-----------|
| MountainChart.tsx | Gráfico de evolução do lucro (Area Chart) |
| CalendarChart.tsx | Heatmap de lucro por dia do mês |

Utilizando Recharts (já instalado no projeto).

### 4.3 Adaptações de Estilo

Mapeamento de classes do projeto original para o design system atual:

| Original (Shark ADM) | Adaptado (OddsCompare) |
|----------------------|------------------------|
| bg-slate-900/50 | bg-card |
| border-slate-800 | border-border |
| text-white | text-foreground |
| text-slate-400 | text-muted-foreground |
| from-blue-500 to-purple-600 | bg-primary |
| bg-emerald-500/10 | bg-success/10 |

---

## Fase 5: Página Principal

### 5.1 Criar `src/pages/ProcedureControl.tsx`

Página adaptada do `ProcedureControl.jsx` com:

- Header com título e botão "Adicionar Procedimento"
- Seletor de mês
- Grid de 5 StatCards (Lucro, Média Diária, Média Proc/Dia, Total, etc.)
- Grid de 5 StatCards adicionais (Abertos, Partidas em Aberto, Melhor Plataforma, etc.)
- NotificationPanel para alertas urgentes
- ProcedureFilters para filtros avançados
- CalendarChart (heatmap mensal)
- MountainChart (evolução do lucro)
- Tabela/Cards de procedimentos com ações

Funcionalidades:
- Cálculos de estatísticas (lucro mensal, média diária, melhor plataforma, etc.)
- Filtros client-side (mês, plataforma, categoria, status, tags, favoritos)
- Ordenação por número de procedimento
- Toggle de favoritos
- Edição inline via modal
- Importação CSV
- Personalização de colunas visíveis (persistido no localStorage)

---

## Fase 6: Navegação e Rotas

### 6.1 Atualizar `src/components/Sidebar.tsx`

Adicionar item no array `navigation`:

```text
{
  name: 'Controle de Procedimentos',
  href: '/procedures',
  icon: FileText,
  adminOnly: true,
  pageKey: PAGE_KEYS.PROCEDURE_CONTROL
}
```

### 6.2 Atualizar `src/components/AnimatedRoutes.tsx`

Adicionar rota protegida:

- Path: `/procedures`
- Componente: RequireAuth com requireAdmin={true} e pageKey={PAGE_KEYS.PROCEDURE_CONTROL}
- Wrapper: PageTransition

---

## Resumo de Arquivos

### Novos Arquivos (16 arquivos)

| Tipo | Arquivo |
|------|---------|
| Config | src/lib/supabaseProcedures.ts |
| Types | src/types/procedures.ts |
| Hook | src/hooks/useProcedures.ts |
| Componente | src/components/procedures/ProcedureStats.tsx |
| Componente | src/components/procedures/ProcedureFilters.tsx |
| Componente | src/components/procedures/ProcedureTable.tsx |
| Componente | src/components/procedures/ProcedureMobileCards.tsx |
| Componente | src/components/procedures/ProcedureModal.tsx |
| Componente | src/components/procedures/ImportModal.tsx |
| Componente | src/components/procedures/ColumnCustomizer.tsx |
| Componente | src/components/procedures/TagManager.tsx |
| Componente | src/components/procedures/NotificationPanel.tsx |
| Componente | src/components/procedures/MountainChart.tsx |
| Componente | src/components/procedures/CalendarChart.tsx |
| Página | src/pages/ProcedureControl.tsx |

### Arquivos Modificados (3 arquivos)

| Arquivo | Modificação |
|---------|-------------|
| .env | Adicionar VITE_PROCEDURES_* |
| src/types/auth.ts | Adicionar PROCEDURE_CONTROL ao PAGE_KEYS |
| src/components/Sidebar.tsx | Adicionar link de navegação |
| src/components/AnimatedRoutes.tsx | Adicionar rota /procedures |

---

## Sequência de Implementação

1. Configurar variáveis de ambiente (.env)
2. Criar cliente Supabase secundário (supabaseProcedures.ts)
3. Criar tipos TypeScript (procedures.ts)
4. Atualizar PAGE_KEYS (auth.ts)
5. Criar hook useProcedures
6. Criar componentes auxiliares (TagManager, ColumnCustomizer)
7. Criar componentes de UI (Stats, Filters, Modal, Table, Cards)
8. Criar componentes de gráficos (MountainChart, CalendarChart)
9. Criar página principal (ProcedureControl.tsx)
10. Atualizar Sidebar e AnimatedRoutes

---

## Pré-requisitos

Para implementar, você precisará fornecer:

1. **URL do Supabase secundário** (onde está a tabela procedures)
2. **Anon Key do Supabase secundário**

Essas credenciais serão adicionadas como variáveis de ambiente no projeto.

---

## Considerações de Segurança

- A página só é acessível para usuários autenticados como admin no Supabase principal
- A verificação de admin acontece no frontend via RequireAuth e no AuthContext
- O Supabase secundário é acessado apenas para operações CRUD na tabela procedures
- Se o RLS estiver habilitado no Supabase secundário, pode ser necessário usar Service Role Key ou desabilitar RLS para a tabela procedures

