

# Remover Arquivos Orfaos

## Arquivos a remover

Apos desativar as 3 abas, os seguintes arquivos nao sao mais importados por nenhum codigo ativo:

### Paginas (3 arquivos)
- `src/pages/MonitorFutebol.tsx`
- `src/pages/MonitorBasquete.tsx`
- `src/pages/FreebetExtraction.tsx`

### Componentes Freebet (3 arquivos)
- `src/components/freebet/FreebetCard.tsx`
- `src/components/freebet/FreebetConfig.tsx`
- `src/components/freebet/FreebetFilters.tsx`

### Componentes do Monitor de Odds (4 arquivos)
- `src/components/OddsMonitor.tsx` — usado apenas por MonitorFutebol/Basquete
- `src/components/OddsComparisonTable.tsx` — nao importado em nenhum lugar ativo
- `src/components/OddsFilters.tsx` — usado apenas por OddsMonitor e OddsComparisonTable
- `src/components/MatchCardSkeleton.tsx` — usado apenas por OddsMonitor
- `src/components/ViewToggle.tsx` — usado apenas por OddsMonitor e OddsComparisonTable
- `src/components/StatsCards.tsx` — usado apenas por MonitorFutebol/Basquete

### Hooks orfaos (2 arquivos)
- `src/hooks/useSurebetDetection.ts` — usado apenas por OddsMonitor
- `src/hooks/useFiltersFromUrl.ts` — usado apenas por OddsMonitor e OddsComparisonTable

### Libs e tipos orfaos (2 arquivos)
- `src/lib/freebetUtils.ts` — usado apenas por FreebetExtraction e FreebetCard
- `src/types/freebet.ts` — usado apenas por freebetUtils e componentes freebet

**Total: 15 arquivos a remover**

### Arquivos que ficam (nao sao orfaos)
- `src/components/SurebetCalculator.tsx` — ainda usado por `MatchDetails.tsx`
- `src/hooks/useOddsData.ts` — ainda usado por varias paginas ativas
- `src/lib/bookmakerLinks.ts` — ainda usado por `MatchDetails.tsx`

## Implementacao

Deletar os 15 arquivos listados acima e remover o diretorio `src/components/freebet/`.

