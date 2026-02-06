
# Plano: Corrigir Desaparecimento de Jogos da Libertadores no Monitor

## Diagnóstico

O problema de jogos da Libertadores aparecerem e sumirem pode ser causado por múltiplas camadas do sistema:

### Causas Identificadas

| Camada | Problema | Impacto |
|--------|----------|---------|
| **Backend (View SQL)** | Filtro `is_latest = TRUE` pode falhar se trigger tiver race condition | Partidas sem odds visíveis |
| **Backend (JSON Generator)** | Deduplicação por composite key sobrescreve jogos duplicados | Jogos perdidos |
| **Frontend (groupOddsByMatch)** | Filtro `fiveMinutesAgo` com timezone incorreto | Jogos descartados cedo demais |
| **Frontend (React Query)** | Sem fallback para dados anteriores quando fetch falha | Dados somem em erros |
| **Dados (Times Duplicados)** | 9 times duplicados podem criar inconsistências | Jogos associados a times órfãos |

---

## Soluções Propostas

### Parte 1: Frontend - React Query com Configuração Resiliente

Configurar o `QueryClient` para:
- Manter dados antigos em caso de erro (`keepPreviousData`)
- Não refetch agressivo em window focus
- Cache mais duradouro

**Arquivo**: `src/App.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 segundos antes de considerar stale
      gcTime: 5 * 60 * 1000, // 5 minutos no cache
      retry: 2,
      refetchOnWindowFocus: false, // Evita refetch ao voltar para aba
      refetchOnReconnect: true,
    },
  },
});
```

### Parte 2: Frontend - Remover Filtro de 5 Minutos Redundante

O JSON Generator já filtra partidas passadas. O frontend não precisa refiltrar, o que pode causar discrepâncias de timezone.

**Arquivo**: `src/hooks/useOddsData.ts` - Função `groupOddsByMatch`

Remover as linhas 450-455:
```typescript
// REMOVER:
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
// REMOVER:
if (matchDate < fiveMinutesAgo) continue;
```

O filtro no backend (view SQL) já cuida disso com `m.match_date > (NOW() - INTERVAL '30 minutes')`.

### Parte 3: Frontend - Invalidação Inteligente do Cache

Adicionar invalidação do cache quando o JSON é atualizado com sucesso:

**Arquivo**: `src/hooks/useOddsData.ts` - Hook `useOddsComparison`

```typescript
export const useOddsComparison = (filters?: { ... }) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['odds_comparison', filters],
    queryFn: async () => {
      // ... fetch logic
    },
    refetchInterval: 15000,
    staleTime: 10000,
    placeholderData: (previousData) => previousData, // Manter dados antigos durante loading
    retry: 3,
  });
};
```

### Parte 4: Backend - Melhorar Resiliência do JSON Generator

O JSON generator deve ter fallback para dados anteriores se o fetch falhar.

**Arquivo**: `docs/scraper/standalone/run_json_generator.py`

Adicionar cache local do último JSON gerado com sucesso:
```python
last_valid_json = None

async def run_forever(interval: int, log: logger):
    global last_valid_json
    
    # ... dentro do loop
    if success:
        last_valid_json = json_data  # Salvar JSON válido
    elif last_valid_json:
        # Re-upload último JSON válido em caso de erro
        supabase.upload_odds_json(last_valid_json)
        log.warning("Re-uploaded last valid JSON due to error")
```

### Parte 5: Backend - Verificar Integridade do Trigger

Criar query de diagnóstico para identificar partidas sem odds `is_latest`:

```sql
-- Partidas com odds mas nenhuma is_latest = TRUE
SELECT m.id, ht.standard_name, at.standard_name, l.name
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
JOIN leagues l ON m.league_id = l.id
WHERE m.match_date > NOW()
AND NOT EXISTS (
    SELECT 1 FROM odds_history oh 
    WHERE oh.match_id = m.id AND oh.is_latest = TRUE
)
AND EXISTS (
    SELECT 1 FROM odds_history oh 
    WHERE oh.match_id = m.id
);
```

---

## Alterações de Código

### Arquivo 1: `src/App.tsx`

Configurar QueryClient com opções resilientes:

```typescript
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 segundos
      gcTime: 5 * 60 * 1000, // 5 minutos
      retry: 2,
      refetchOnWindowFocus: false, // Evita reset ao trocar de aba
      refetchOnReconnect: true,
    },
  },
});

const App = () => (
  // ... resto igual
);
```

### Arquivo 2: `src/hooks/useOddsData.ts`

**Mudança 1**: Remover filtro redundante de 5 minutos na função `groupOddsByMatch`:

```typescript
function groupOddsByMatch(data: OddsComparison[]): MatchOddsGroup[] {
  const matchMap = new Map<string, MatchOddsGroup>();
  // REMOVIDO: const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  for (const row of data) {
    // REMOVIDO: filtro de matchDate < fiveMinutesAgo
    
    if (!matchMap.has(row.match_id)) {
      // ... resto da lógica
    }
    // ...
  }
  return Array.from(matchMap.values());
}
```

**Mudança 2**: Adicionar `placeholderData` no hook `useOddsComparison`:

```typescript
export const useOddsComparison = (filters?: {...}) => {
  return useQuery({
    queryKey: ['odds_comparison', filters],
    queryFn: async () => {
      // ... fetch logic existente
    },
    refetchInterval: 15000,
    staleTime: 10000,
    placeholderData: (previousData) => previousData, // NOVO: manter dados durante refetch
  });
};
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Configurar QueryClient com `refetchOnWindowFocus: false` e staleTime maior |
| `src/hooks/useOddsData.ts` | Remover filtro redundante de 5 minutos em `groupOddsByMatch` |
| `src/hooks/useOddsData.ts` | Adicionar `placeholderData` para manter dados durante loading |

---

## Benefícios Esperados

1. **Dados persistem ao trocar de aba**: `refetchOnWindowFocus: false` evita resets desnecessários
2. **Sem filtros de timezone conflitantes**: Remoção do filtro de 5 minutos no frontend
3. **Dados visíveis durante loading**: `placeholderData` mantém última versão enquanto busca nova
4. **Cache mais eficiente**: Reduz chamadas desnecessárias ao JSON

---

## Notas Técnicas

### Por que remover o filtro de 5 minutos?

O pipeline de dados já aplica esse filtro em duas camadas:
1. **View SQL**: `m.match_date > (NOW() - INTERVAL '30 minutes')`
2. **JSON Generator**: `if match_date < five_minutes_ago: continue`

Aplicar novamente no frontend pode causar problemas porque:
- O timezone do browser pode diferir do servidor
- Cria discrepância entre o que o JSON contém e o que é exibido

### React Query `placeholderData` vs `keepPreviousData`

- `placeholderData: (prev) => prev` mostra os dados antigos instantaneamente
- Evita o "flash" de loading entre refetches
- Se o fetch falhar, os dados antigos permanecem visíveis
