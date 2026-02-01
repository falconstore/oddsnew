

# Reverter Monitor Principal - Mostrar Apenas Melhores Odds

## Problema

A modificação anterior aplicou incorretamente a separação SO/PA na página principal do monitor. O usuário quer:
- **Página principal** (OddsMonitor/OddsComparisonTable): Mostrar apenas as melhores odds de ambos (como era antes)
- **Página de detalhes** (MatchDetails): Manter a separação SO/PA (laranja e verde)

## O que será revertido

| Arquivo | Mudança |
|---------|---------|
| `src/components/OddsMonitor.tsx` | Remover seções SO/PA, voltar ao grid único com melhores odds |
| `src/components/OddsComparisonTable.tsx` | Remover seções SO/PA, voltar ao grid único com melhores odds |

## Layout Atual (errado)

```text
┌──────────────────────────────────────────┐
│ ● SO / Betbra                   (laranja)│
│   1.87 | 3.75 | 5.10 | ROI +0.25%        │
├──────────────────────────────────────────┤
│ ● PA - Top 3                     (verde) │
│   1.87 Estrelab | 3.67 Estrelab | ...    │
└──────────────────────────────────────────┘
```

## Layout Desejado (como era antes)

```text
┌──────────────────────────────────────────┐
│  Betano    │  Betbra   │  Betbra   │ ROI │
│   1.87     │   3.75    │   5.10    │+0.25│
│   Casa     │  Empate   │   Fora    │     │
└──────────────────────────────────────────┘
```

Apenas um grid com as melhores odds gerais (combinando SO e PA), com destaque verde nas melhores.

## Mudanças Técnicas

### 1. OddsMonitor.tsx - MatchCard (linhas 324-531)

**Remover:**
- Import de `getBestOddsByType`, `calculateROI`, `getBestPAOdds`
- Lógica de separação SO/PA (linhas 331-339)
- Seção SO/Betbra (linhas 395-447)
- Seção PA - Top 3 (linhas 449-519)
- Fallback sem odds (linhas 521-526)

**Restaurar:**
- Grid único mostrando `match.best_home`, `match.best_draw`, `match.best_away`
- Destacar melhores odds com cor verde
- Mostrar nome da casa com melhor odd
- ROI geral calculado com todas as odds

### 2. OddsComparisonTable.tsx - MatchCard (linhas 322-528)

**Mesmas mudanças** que o OddsMonitor.tsx para manter consistência.

## Código a Restaurar (OddsMonitor MatchCard)

```tsx
function MatchCard({ match }: { match: MatchOddsGroup }) {
  const navigate = useNavigate();
  const matchDate = new Date(match.match_date);
  const isLive = match.match_status === 'live';
  const isBasketball = (match.sport_type || 'football') === 'basketball';
  const sportIcon = isBasketball ? '🏀' : '⚽';
  
  // Calculate best bookmakers for each outcome
  const bestHomeBookmaker = match.odds.reduce((best, o) => 
    o.home_odd > (best?.home_odd || 0) ? o : best, match.odds[0])?.bookmaker_name;
  const bestDrawBookmaker = match.odds.reduce((best, o) => 
    (o.draw_odd || 0) > (best?.draw_odd || 0) ? o : best, match.odds[0])?.bookmaker_name;
  const bestAwayBookmaker = match.odds.reduce((best, o) => 
    o.away_odd > (best?.away_odd || 0) ? o : best, match.odds[0])?.bookmaker_name;
  
  // Calculate arbitrage (overall)
  const arbitrageValue = isBasketball || match.best_draw === null || match.best_draw === 0
    ? (1/match.best_home + 1/match.best_away)
    : (1/match.best_home + 1/match.best_draw + 1/match.best_away);
  const hasArbitrage = arbitrageValue < 1 && match.odds.length > 0;
  const roiPercentage = ((1 - arbitrageValue) * 100).toFixed(2);
  
  return (
    <Card ...>
      {/* ... header com times, liga, data ... */}
      
      {/* Best Odds Grid - único, cor verde */}
      <div className="pt-2 sm:pt-3 border-t">
        <div className={cn(
          "grid gap-2 sm:gap-4",
          isBasketball ? "grid-cols-3" : "grid-cols-4"
        )}>
          {/* Casa */}
          <div className="text-center group">
            <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {bestHomeBookmaker}
            </div>
            <div className={cn(
              "font-bold text-lg sm:text-xl font-mono",
              hasArbitrage ? "text-success" : "text-primary"
            )}>
              {match.best_home.toFixed(2)}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              {isBasketball ? 'Time 1' : 'Casa'}
            </div>
          </div>
          
          {/* Empate (futebol) */}
          {!isBasketball && (
            <div className="text-center group">
              <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {bestDrawBookmaker}
              </div>
              <div className={cn(
                "font-bold text-lg sm:text-xl font-mono",
                hasArbitrage ? "text-success" : "text-primary"
              )}>
                {match.best_draw !== null ? match.best_draw.toFixed(2) : '-'}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Empate</div>
            </div>
          )}
          
          {/* Fora */}
          <div className="text-center group">
            <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {bestAwayBookmaker}
            </div>
            <div className={cn(
              "font-bold text-lg sm:text-xl font-mono",
              hasArbitrage ? "text-success" : "text-primary"
            )}>
              {match.best_away.toFixed(2)}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              {isBasketball ? 'Time 2' : 'Fora'}
            </div>
          </div>
          
          {/* ROI */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs text-muted-foreground">ROI</div>
            <div className={cn(
              "font-bold text-lg sm:text-xl font-mono",
              hasArbitrage ? "text-success" : "text-muted-foreground"
            )}>
              {Number(roiPercentage) > 0 ? `+${roiPercentage}%` : `${roiPercentage}%`}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

## Resumo

| Arquivo | Ação |
|---------|------|
| `OddsMonitor.tsx` | Remover import oddsTypeUtils, reverter MatchCard para grid único verde |
| `OddsComparisonTable.tsx` | Remover import oddsTypeUtils, reverter MatchCard para grid único verde |
| `MatchDetails.tsx` | **Manter como está** (separação SO/PA) |
| `oddsTypeUtils.ts` | **Manter** (usado pelo MatchDetails) |

