

# Adicionar Filtros Inteligentes na Extração de Freebet

## Visao Geral

Adicionar filtros avancados para a aba de extracao de freebet, permitindo que o usuario selecione em qual casa tem a freebet, filtre por data/liga, e defina uma extracao minima.

## Novos Filtros

| Filtro | Tipo | Descricao |
|--------|------|-----------|
| Casa da Freebet | Dropdown | Selecionar onde a freebet esta (ex: Bet365) - a freebet DEVE estar nessa casa |
| Data | Calendario Multi-select | Selecionar datas especificas |
| Liga | Multi-select | Filtrar por campeonato |
| Extracao Minima | Slider ou Input | Percentual minimo de extracao (ex: 50%) |

## Mudanca de Logica Principal

Quando o usuario selecionar uma casa (ex: "Bet365"):
- O sistema busca a melhor odd PA dessa casa especifica (Casa ou Fora - a maior)
- A freebet e colocada nessa odd
- O empate usa SO (Betbra prioritario)
- O outro resultado usa a melhor odd PA disponivel (qualquer casa)
- Limite de 30 resultados ordenados por melhor extracao

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/freebet/FreebetFilters.tsx` | Componente de filtros (Casa, Data, Liga, Extracao) |
| `src/hooks/useFreebetFilters.ts` | Hook para gerenciar estado dos filtros (opcional, pode usar URL) |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/freebetUtils.ts` | Adicionar funcao para filtrar por casa especifica da freebet |
| `src/pages/FreebetExtraction.tsx` | Integrar filtros e aplicar logica |
| `src/components/freebet/FreebetConfig.tsx` | Integrar com os novos filtros |

## Layout Proposto

```text
+----------------------------------------------------------+
|  Extracao Freebet                          28 oportunidades |
+----------------------------------------------------------+
|  [Casa da Freebet ▼]  [Valor R$]  [Extracao Min %]       |
|  [Ligas ▼]  [Datas ▼]  [Limpar filtros]                  |
+----------------------------------------------------------+
```

## Detalhes Tecnicos

### 1. Interface de Filtros (FreebetFilters.tsx)

```typescript
interface FreebetFiltersState {
  freebetBookmaker: string | null;  // Casa onde a freebet esta
  leagues: string[];                // Ligas selecionadas
  dates: string[];                  // Datas selecionadas (yyyy-MM-dd)
  minExtraction: number;            // Extracao minima (0-100)
}
```

### 2. Nova Logica em freebetUtils.ts

Nova funcao `generateFreebetOpportunitiesWithFilters`:

```typescript
export function generateFreebetOpportunitiesWithFilters(
  matches: MatchOddsGroup[],
  freebetValue: number,
  freebetBookmaker: string | null,  // Casa onde a freebet esta
  generateLink: (...) => string | null,
  filters?: {
    leagues?: string[];
    dates?: string[];
    minExtraction?: number;
  }
): FreebetOpportunity[] {
  // 1. Aplicar filtros de liga/data nos matches
  let filtered = matches.filter(m => {
    if (filters?.leagues?.length && !filters.leagues.includes(m.league_name)) return false;
    if (filters?.dates?.length && !filters.dates.includes(m.match_date.slice(0, 10))) return false;
    return true;
  });

  // 2. Para cada match, buscar oportunidade
  for (const match of filtered) {
    if (freebetBookmaker) {
      // LOGICA ESPECIFICA: Freebet deve estar na casa selecionada
      const bookmakerOdds = match.odds.filter(o => 
        o.bookmaker_name.toLowerCase().includes(freebetBookmaker.toLowerCase())
      );
      
      if (bookmakerOdds.length === 0) continue; // Casa nao tem odds para esse jogo
      
      // Pegar a melhor odd (Casa ou Fora) dessa casa especifica
      const bestHomeFromBookmaker = bookmakerOdds
        .filter(o => !isSOBookmaker(o.bookmaker_name, o.odds_type))
        .sort((a, b) => b.home_odd - a.home_odd)[0];
      const bestAwayFromBookmaker = bookmakerOdds
        .filter(o => !isSOBookmaker(o.bookmaker_name, o.odds_type))
        .sort((a, b) => b.away_odd - a.away_odd)[0];
      
      // Determinar posicao da freebet (maior odd da casa selecionada)
      // ... resto da logica
    } else {
      // Logica atual: melhor odd PA de qualquer casa
    }
  }

  // 3. Filtrar por extracao minima
  opportunities = opportunities.filter(o => o.extraction >= (filters?.minExtraction || 0));
  
  // 4. Ordenar e limitar a 30 resultados
  opportunities.sort((a, b) => b.extraction - a.extraction);
  return opportunities.slice(0, 30);
}
```

### 3. Componente FreebetFilters

Usa os mesmos componentes do OddsFilters:
- `MultiSelectPopover` para Ligas
- `Popover` com `Calendar` para Datas
- `Select` para Casa da Freebet
- `Slider` ou `Input` para Extracao Minima

### 4. Integracao na Pagina

```typescript
export default function FreebetExtraction() {
  const [freebetValue, setFreebetValue] = useState(10);
  const [filters, setFilters] = useState<FreebetFiltersState>({
    freebetBookmaker: null,
    leagues: [],
    dates: [],
    minExtraction: 0,
  });
  
  const { data: matches } = useOddsComparison();
  const { data: bookmakers } = useBookmakers();
  
  const opportunities = useMemo(() => {
    if (!matches) return [];
    return generateFreebetOpportunitiesWithFilters(
      matches,
      freebetValue,
      filters.freebetBookmaker,
      generateBookmakerLink,
      {
        leagues: filters.leagues,
        dates: filters.dates,
        minExtraction: filters.minExtraction,
      }
    );
  }, [matches, freebetValue, filters]);
  
  // Lista de casas disponiveis para o dropdown
  const availableBookmakers = useMemo(() => {
    return bookmakers?.filter(b => b.status === 'active') || [];
  }, [bookmakers]);
  
  return (
    <Layout>
      <FreebetConfig ... />
      <FreebetFilters 
        filters={filters}
        onFiltersChange={setFilters}
        bookmakers={availableBookmakers}
      />
      {/* Cards */}
    </Layout>
  );
}
```

## Fluxo do Usuario

1. Usuario abre a aba "Extracao Freebet"
2. Seleciona "Bet365" no dropdown "Casa da Freebet"
3. Sistema mostra ate 30 jogos onde a Bet365 tem odds
4. A freebet esta sempre na maior odd (Casa ou Fora) da Bet365
5. Cards ordenados por melhor % de extracao
6. Usuario pode refinar com filtros de Liga, Data e Extracao Minima

## Visual do Filtro de Extracao

```text
Extracao Minima: [====●======] 50%
```

Ou input simples:
```text
Extracao Min: [50] %
```

## Casas Disponiveis para Freebet

Serao listadas todas as casas PA ativas do banco:
- Bet365
- Betano
- Superbet
- Sportingbet
- KTO
- Esportivabet
- Aposta1
- McGamese outras...

Casas SO (Betbra, Novibet, Betnacional) NAO aparecem no dropdown de freebet pois sao usadas para cobrir o empate.

## Resumo de Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `src/components/freebet/FreebetFilters.tsx` |
| Modificar | `src/lib/freebetUtils.ts` |
| Modificar | `src/pages/FreebetExtraction.tsx` |
| Modificar | `src/components/freebet/FreebetConfig.tsx` (opcional, integrar filtros) |

