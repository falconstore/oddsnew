
# Plano: Nova Aba Betbra Affiliate

## Visao Geral

Criar uma nova aba "Betbra" no sistema para gerenciar dados de afiliacao da Betbra, seguindo os mesmos padroes de UI/UX ja estabelecidos no Controle de Procedimentos. A tabela `betbra_affiliate_data` ja existe no Supabase secundario (Procedures).

---

## Estrutura de Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/BetbraAffiliate.tsx` | Pagina principal com dashboard, graficos e tabela |
| `src/components/betbra/BetbraModal.tsx` | Modal para adicionar/editar registros |
| `src/components/betbra/BetbraTable.tsx` | Tabela compacta de registros |
| `src/components/betbra/BetbraStats.tsx` | Cards de estatisticas (CPA, NGR, Turnover, etc) |
| `src/components/betbra/BetbraCharts.tsx` | Graficos de Turnover e NGR |
| `src/hooks/useBetbraData.ts` | Hook TanStack Query para CRUD |
| `src/types/betbra.ts` | Tipos TypeScript para dados Betbra |
| `src/lib/betbraUtils.ts` | Funcoes utilitarias (calculos CPA, filtros) |

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/types/auth.ts` | Adicionar `BETBRA_AFFILIATE` em PAGE_KEYS |
| `src/components/Sidebar.tsx` | Adicionar link para /betbra |
| `src/components/AnimatedRoutes.tsx` | Adicionar rota /betbra |

---

## Schema da Tabela (betbra_affiliate_data)

```text
id                 uuid        PK, default gen_random_uuid()
created_date       timestamptz default now()
updated_date       timestamptz default now()
created_by         text        nullable
date               date        NOT NULL
registros          numeric     NOT NULL
numero_de_apostas  numeric     NOT NULL
ngr                numeric     NOT NULL
turnover           numeric     NOT NULL
cpa                numeric     NOT NULL
```

---

## Tipos TypeScript

```typescript
// src/types/betbra.ts
export interface BetbraEntry {
  id: string;
  created_date: string | null;
  updated_date: string | null;
  created_by: string | null;
  date: string;
  registros: number;
  numero_de_apostas: number;
  ngr: number;
  turnover: number;
  cpa: number;
}
```

---

## Hook de Dados (useBetbraData.ts)

Seguindo o padrao de `useProcedures.ts`:

- `useBetbraData()` - Fetch com refetch a cada 10s
- `useCreateBetbraEntry()` - Criar registro
- `useUpdateBetbraEntry()` - Atualizar registro
- `useDeleteBetbraEntry()` - Deletar registro

---

## Pagina Principal (BetbraAffiliate.tsx)

### Layout

```text
+-------------------------------------------------------+
|  Header: Betbra + Exportar CSV + Atualizar + Adicionar |
+-------------------------------------------------------+
|  Seletor Periodo  |  Seletor Mes                      |
+-------------------------------------------------------+
|  [CPA Total] [CPA R$] [Revenue Share] [Turnover] [Total]
+-------------------------------------------------------+
|  [Grafico Turnover Diario]  |  [Grafico NGR Diario]  |
+-------------------------------------------------------+
|  [Grafico NGR Acumulado Mensal]                       |
+-------------------------------------------------------+
|  Tabela de Registros com paginacao                    |
+-------------------------------------------------------+
```

### Funcionalidades

1. **Filtro por Periodo**: Semana / Mes / Ano
2. **Seletor de Mes**: Lista meses disponiveis nos dados
3. **Cards de Estatisticas**:
   - CPA Total (contagem)
   - CPA R$ (calculado por niveis: 1-29=R$50, 30-49=R$60, 50-70=R$70, 71-99=R$85, 100+=R$100)
   - Revenue Share (NGR * 15% se NGR > 10k)
   - Turnover R$ (turnover * 0.5% / 2)
   - Total (soma de todos os valores)
4. **Graficos**:
   - Turnover Diario (BarChart)
   - NGR Diario (BarChart)
   - NGR Acumulado (LineChart)
5. **Tabela**:
   - Ordenacao por coluna
   - Paginacao (10 por pagina)
   - Busca
   - Agrupamento (dia/semana/mes)

---

## Calculos de Valores

### CPA R$ (Niveis)

```text
CPA >= 100: R$ 100/CPA
CPA >= 71:  R$ 85/CPA
CPA >= 50:  R$ 70/CPA
CPA >= 30:  R$ 60/CPA
CPA >= 1:   R$ 50/CPA
```

### Revenue Share

```text
Se NGR > 10.000: NGR * 15%
Senao: R$ 0
```

### Turnover R$

```text
(Turnover * 0.5%) / 2
```

---

## UI/UX (Padrao do Sistema)

| Elemento | Especificacao |
|----------|---------------|
| Cards | Padding p-4, rounded-xl, bg-card |
| Tabela | Compacta (py-1 px-1.5), text-xs, h-9 rows |
| Graficos | Altura h-64, usando HSL colors do tema |
| Fontes | text-xs para dados, text-sm para titulos |
| Cores | Usar variaveis --success, --destructive, --primary |
| Modal | Design consistente com ProcedureModal |

---

## Navegacao

### Sidebar

Adicionar item logo apos "Controle Procedimentos":

```typescript
{ 
  name: 'Betbra', 
  href: '/betbra', 
  icon: TrendingUp,  // ou icone customizado
  adminOnly: true, 
  pageKey: PAGE_KEYS.BETBRA_AFFILIATE 
}
```

### Rota

```typescript
<Route path="/betbra" element={
  <RequireAuth requireAdmin pageKey={PAGE_KEYS.BETBRA_AFFILIATE}>
    <PageTransition>
      <BetbraAffiliate />
    </PageTransition>
  </RequireAuth>
} />
```

---

## Componentes Detalhados

### BetbraStats.tsx

5 cards em grid responsivo:

| Card | Cor | Valor |
|------|-----|-------|
| CPA Total | Azul | Soma de todos CPAs |
| CPA R$ | Ciano | Valor calculado por nivel |
| Revenue Share R$ | Verde | NGR * 15% (se > 10k) |
| Turnover R$ | Roxo | (Turnover * 0.5%) / 2 |
| Total | Amarelo | Soma de CPA R$ + Revenue + Turnover |

### BetbraCharts.tsx

3 graficos usando Recharts:

1. **Turnover Diario**: BarChart roxo
2. **NGR Diario**: BarChart verde
3. **NGR Acumulado**: LineChart verde com pontos

### BetbraTable.tsx

Colunas:

| Coluna | Tipo | Ordenavel |
|--------|------|-----------|
| Data | date | Sim |
| Registros | number | Sim |
| Apostas | number | Sim |
| NGR | currency | Sim |
| Turnover | currency | Sim |
| CPA | number | Sim |
| Acoes | buttons | Nao |

### BetbraModal.tsx

Campos do formulario:

| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| Data | date | Sim |
| Registros | number | Sim |
| Numero de Apostas | number | Sim |
| NGR | number (decimal) | Sim |
| Turnover | number (decimal) | Sim |
| CPA | number | Sim |

---

## Resumo de Implementacao

### Etapa 1: Tipos e Utils
- Criar `src/types/betbra.ts`
- Criar `src/lib/betbraUtils.ts`

### Etapa 2: Hook de Dados
- Criar `src/hooks/useBetbraData.ts`

### Etapa 3: Componentes
- Criar `src/components/betbra/BetbraStats.tsx`
- Criar `src/components/betbra/BetbraCharts.tsx`
- Criar `src/components/betbra/BetbraTable.tsx`
- Criar `src/components/betbra/BetbraModal.tsx`

### Etapa 4: Pagina Principal
- Criar `src/pages/BetbraAffiliate.tsx`

### Etapa 5: Navegacao
- Atualizar `src/types/auth.ts` (PAGE_KEYS)
- Atualizar `src/components/Sidebar.tsx`
- Atualizar `src/components/AnimatedRoutes.tsx`

---

## Resultado Esperado

- Nova aba "Betbra" no menu lateral (apenas para admins)
- Dashboard completo com estatisticas e graficos
- Tabela compacta com ordenacao e paginacao
- Modal para CRUD de registros
- UI consistente com o resto do sistema
- Calculos automaticos de CPA, Revenue Share e Turnover
