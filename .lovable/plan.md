
# Plano: Nova Aba Assinaturas (Controle de Pagamentos)

## Visao Geral

Criar uma nova aba "Assinaturas" no sistema para gerenciar assinantes e pagamentos, seguindo o padrao de UI/UX ja estabelecido nas abas "Controle de Procedimentos" e "Betbra". A tabela `subscribers` ja existe no Supabase secundario (Procedures).

---

## Schema da Tabela (subscribers)

```text
id                 uuid        PK, default uuid_generate_v4()
created_date       timestamptz default now()
updated_date       timestamptz default now()
created_by         text        nullable
full_name          text        NOT NULL
telegram_link      text        nullable
amount_paid        numeric     NOT NULL
payment_date       date        NOT NULL
plan               text        NOT NULL
situation          text        default 'Ativo'
```

---

## Estrutura de Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/Subscriptions.tsx` | Pagina principal com dashboard de assinantes |
| `src/components/subscriptions/SubscriptionModal.tsx` | Modal para adicionar/editar assinantes |
| `src/components/subscriptions/SubscriptionTable.tsx` | Tabela compacta de assinantes |
| `src/components/subscriptions/SubscriptionStats.tsx` | Cards de estatisticas |
| `src/components/subscriptions/SubscriptionFilters.tsx` | Filtros de busca e status |
| `src/hooks/useSubscriptions.ts` | Hook TanStack Query para CRUD |
| `src/types/subscriptions.ts` | Tipos TypeScript |
| `src/lib/subscriptionUtils.ts` | Funcoes utilitarias (calculos, filtros) |

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/types/auth.ts` | Adicionar `SUBSCRIPTIONS` em PAGE_KEYS e PAGE_CONFIG |
| `src/components/Sidebar.tsx` | Adicionar link para /subscriptions |
| `src/components/AnimatedRoutes.tsx` | Adicionar rota /subscriptions |

---

## Tipos TypeScript (src/types/subscriptions.ts)

```typescript
export interface Subscriber {
  id: string;
  created_date: string | null;
  updated_date: string | null;
  created_by: string | null;
  full_name: string;
  telegram_link: string | null;
  amount_paid: number;
  payment_date: string;
  plan: string;
  situation: string;
}

export type SubscriberPlan = 'Semanal' | 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';

export type SubscriberSituation = 
  | 'Ativo'
  | 'Cobrado' 
  | 'Lembrete Enviado'
  | 'Removido do Grupo'
  | 'Pago via LastLink'
  | 'Pago via Hotmart'
  | 'Pagamento Pendente'
  | 'Outro';

export interface SubscriptionFilters {
  searchName: string;
  plan: string;
  status: string;
  situation: string;
  daysRemaining: string;
}

export interface SubscriptionStats {
  totalReceived: number;
  pendingCount: number;
  totalSubscribers: number;
  activeCount: number;
  expiredCount: number;
  removedCount: number;
}
```

---

## Funcionalidades Principais

### 1. Cards de Estatisticas (6 cards)

| Card | Icone | Cor | Valor |
|------|-------|-----|-------|
| Total Recebido | DollarSign | Verde | Soma de amount_paid |
| Pagamentos Pendentes | AlertCircle | Amarelo | Qtd com situation = "Pagamento Pendente" ou "Lembrete Enviado" |
| Total Assinantes | Users | Azul | Total de registros |
| Ativos | UserCheck | Verde | Ativos com dias > 0 |
| Expirados | UserX | Laranja | Ativos com dias <= 0 |
| Removidos | UserX | Vermelho | Qtd com situation = "Removido do Grupo" |

### 2. Filtros

| Filtro | Tipo | Opcoes |
|--------|------|--------|
| Buscar por Nome | Input texto | Busca parcial |
| Plano | Select | Todos, Semanal, Mensal, Trimestral, Semestral, Anual |
| Status | Select | Todos, Ativo, Expirado |
| Situacao | Select | Todos, Ativo, Cobrado, Lembrete Enviado, etc |
| Vencimento | Select | Todos, Ativos (>7 dias), Vencendo (<=7 dias), Expirados |

### 3. Calculo de Dias Restantes

| Plano | Dias |
|-------|------|
| Semanal | 7 |
| Mensal | 30 |
| Trimestral | 90 |
| Semestral | 180 |
| Anual | 365 |

**Formula:** `Data Pagamento + Dias do Plano - Hoje = Dias Restantes`

### 4. Tabela (Desktop)

| Coluna | Tipo | Ordenavel |
|--------|------|-----------|
| Nome | texto | Sim |
| Telegram | link | Nao |
| Valor | currency | Sim |
| Data Pagamento | date | Sim |
| Plano | badge | Sim |
| Dias Restantes | numero/texto | Sim |
| Status | badge | Sim |
| Situacao | texto | Nao |
| Acoes | botoes | Nao |

### 5. Cards Mobile

Layout compacto para dispositivos moveis com todas as informacoes em cards empilhados.

---

## Layout da Pagina

```text
+-------------------------------------------------------+
|  Header: Assinaturas + Atualizar + Adicionar          |
+-------------------------------------------------------+
|  [R$ Total] [Pendentes] [Total] [Ativos] [Expir] [Rem] |
+-------------------------------------------------------+
|  Filtros: Nome | Plano | Status | Situacao | Vencim.  |
+-------------------------------------------------------+
|  Tabela de Assinantes (Desktop) / Cards (Mobile)      |
+-------------------------------------------------------+
```

---

## Hook de Dados (useSubscriptions.ts)

Seguindo padrao de useBetbraData.ts:

- `useSubscriptions()` - Fetch com refetch a cada 10s
- `useCreateSubscriber()` - Criar assinante
- `useUpdateSubscriber()` - Atualizar assinante  
- `useDeleteSubscriber()` - Deletar assinante

---

## Modal de Assinante

### Campos do Formulario

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| Nome Completo | texto | Sim |
| Link Telegram | texto | Nao |
| Valor Pago | numero | Sim |
| Data Pagamento | date | Sim |
| Plano | select | Sim |
| Situacao | select | Sim |

### Opcoes de Plano
- Semanal
- Mensal
- Trimestral
- Semestral
- Anual

### Opcoes de Situacao
- Ativo
- Cobrado
- Lembrete Enviado
- Removido do Grupo
- Pago via LastLink
- Pago via Hotmart
- Pagamento Pendente
- Outro

---

## UI/UX (Padrao do Sistema)

| Elemento | Especificacao |
|----------|---------------|
| Cards | Padding p-4, rounded-xl, bg-card |
| Tabela | Compacta (py-1 px-1.5), text-xs, h-9 rows |
| Fontes | text-xs para dados, text-sm para titulos |
| Cores | Usar variaveis HSL do tema (--success, --destructive, --primary) |
| Modal | Dialog do Radix, design consistente |
| Badges | Cores semanticas por status/plano |

---

## Navegacao

### Sidebar

Adicionar item apos "Betbra":

```typescript
{ 
  name: 'Assinaturas', 
  href: '/subscriptions', 
  icon: CreditCard,
  adminOnly: true, 
  pageKey: PAGE_KEYS.SUBSCRIPTIONS 
}
```

### Rota

```typescript
<Route path="/subscriptions" element={
  <RequireAuth requireAdmin pageKey={PAGE_KEYS.SUBSCRIPTIONS}>
    <PageTransition>
      <Subscriptions />
    </PageTransition>
  </RequireAuth>
} />
```

---

## Cores de Status

| Status | Cor Badge |
|--------|-----------|
| Ativo (>7 dias) | Verde (success) |
| Vencendo (1-7 dias) | Amarelo (warning) |
| Expirado (<=0 dias) | Vermelho (destructive) |

| Situacao | Cor Texto |
|----------|-----------|
| Ativo | Verde |
| Pagamento Pendente | Amarelo |
| Removido do Grupo | Vermelho |
| Outros | Cinza |

---

## Resumo de Implementacao

### Etapa 1: Tipos e Utils
- Criar `src/types/subscriptions.ts`
- Criar `src/lib/subscriptionUtils.ts`

### Etapa 2: Hook de Dados
- Criar `src/hooks/useSubscriptions.ts`

### Etapa 3: Componentes
- Criar `src/components/subscriptions/SubscriptionStats.tsx`
- Criar `src/components/subscriptions/SubscriptionFilters.tsx`
- Criar `src/components/subscriptions/SubscriptionTable.tsx`
- Criar `src/components/subscriptions/SubscriptionModal.tsx`

### Etapa 4: Pagina Principal
- Criar `src/pages/Subscriptions.tsx`

### Etapa 5: Navegacao
- Atualizar `src/types/auth.ts` (PAGE_KEYS + PAGE_CONFIG)
- Atualizar `src/components/Sidebar.tsx`
- Atualizar `src/components/AnimatedRoutes.tsx`

---

## Resultado Esperado

- Nova aba "Assinaturas" no menu lateral (apenas para admins)
- Dashboard com 6 cards de estatisticas
- Filtros completos (nome, plano, status, situacao, vencimento)
- Tabela responsiva com calculo automatico de dias restantes
- Modal para CRUD de assinantes
- UI consistente com o resto do sistema
- Cores semanticas para status de vencimento
