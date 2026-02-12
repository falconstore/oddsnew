

# Plano: Desativar Abas e Persistir Estado de Filtros

## Parte 1 — Desativar 3 abas

Remover completamente as abas **Monitor Futebol**, **Monitor Basquete** e **Extracao de Freebet** da navegacao e rotas.

### Arquivos afetados

1. **`src/components/Sidebar.tsx`** — Remover os 3 itens do array `navigation` (linhas 76-78)
2. **`src/components/AnimatedRoutes.tsx`** — Remover as 3 rotas (`/monitor-futebol`, `/monitor-basquete`, `/freebet`) e seus imports
3. **`src/pages/Dashboard.tsx`** — Remover os cards de "Monitor Futebol" e "Monitor Basquete" que linkam para as paginas removidas. Redirecionar a Dashboard para ser uma pagina de boas-vindas simples ou redirecionar direto para outra aba (ex: Procedimentos)
4. **`src/types/auth.ts`** — Remover `MONITOR_FUTEBOL`, `MONITOR_BASQUETE` e `FREEBET_EXTRACTION` de `PAGE_KEYS`, `PAGE_CONFIG` e `DEFAULT_USER_PERMISSIONS`

Os arquivos de pagina (`MonitorFutebol.tsx`, `MonitorBasquete.tsx`, `FreebetExtraction.tsx`) e componentes associados serao mantidos no repositorio mas nao mais acessiveis — podem ser removidos posteriormente se desejado.

---

## Parte 2 — Persistir estado ao navegar entre abas

### Problema

Todas as paginas usam `useState` local para filtros. Quando o usuario navega para outra aba e volta, o componente e desmontado e todo o estado (filtros, mes selecionado, configuracoes) e perdido.

### Solucao: Persistir filtros em `sessionStorage`

Criar um hook customizado `usePersistedState` que funciona como `useState` mas salva/restaura automaticamente de `sessionStorage`. Assim o estado sobrevive navegacao entre paginas mas e limpo ao fechar a aba do navegador.

```text
src/hooks/usePersistedState.ts
  - usePersistedState<T>(key: string, defaultValue: T): [T, (v: T) => void]
  - Salva em sessionStorage a cada mudanca
  - Restaura ao montar o componente
```

### Paginas que receberao persistencia

| Pagina | Estado persistido | Chave sessionStorage |
|--------|------------------|---------------------|
| ProcedureControl | `filters`, `selectedMonth`, `visibleColumns` | `proc_filters`, `proc_month`, `proc_columns` |
| BetbraAffiliate | `selectedMonth` | `betbra_month` |
| Subscriptions | `filters` | `subs_filters` |
| EntityManagement | tab ativa | `cadastros_tab` |

Nota: `visibleColumns` em ProcedureControl ja usa `localStorage` — sera migrado para usar o mesmo hook por consistencia.

### Arquivos afetados

1. **Novo:** `src/hooks/usePersistedState.ts`
2. **`src/pages/ProcedureControl.tsx`** — Trocar `useState` por `usePersistedState` nos filtros e mes
3. **`src/pages/BetbraAffiliate.tsx`** — Trocar `useState` por `usePersistedState` no mes
4. **`src/pages/Subscriptions.tsx`** — Trocar `useState` por `usePersistedState` nos filtros
5. **`src/pages/EntityManagement.tsx`** — Persistir tab ativa

---

## Ordem de implementacao

1. Criar `usePersistedState` hook
2. Remover as 3 abas da Sidebar, rotas e Dashboard
3. Limpar `PAGE_KEYS` e `PAGE_CONFIG`
4. Aplicar `usePersistedState` nas 4 paginas restantes
5. Testar navegacao entre abas para confirmar persistencia

## Risco

Baixo. A remocao das abas e direta (sem dependencias cruzadas). O hook de persistencia e uma camada fina sobre `useState` + `sessionStorage`.

