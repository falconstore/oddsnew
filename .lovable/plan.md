

# Separar Melhores Odds por Tipo (SO vs PA)

## Objetivo

Exibir as melhores odds separadamente por tipo:
- **SO/Betbra** (tom laranja): Melhores odds de Super Odds e Betbra
- **PA** (tom verde): Top 3 melhores odds de Pagamento Antecipado

## Mudanças Visuais

```text
Antes (grid único):
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Casa      │   Empate    │    Fora     │    ROI      │
│   2.10      │    3.50     │    2.80     │   -2.5%     │
│  Superbet   │   Betano    │   Novibet   │             │
└─────────────┴─────────────┴─────────────┴─────────────┘

Depois (2 seções):
┌─────────────────────────────────────────────────────────┐
│ SO / Betbra                                    (laranja)│
├─────────────┬─────────────┬─────────────┬─────────────┤
│   Casa      │   Empate    │    Fora     │    ROI      │
│   2.10      │    3.50     │    2.80     │   -2.5%     │
│  Betbra     │   Novibet   │   Betbra    │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
┌─────────────────────────────────────────────────────────┐
│ PA - Top 3                                      (verde) │
├─────────────┬─────────────┬─────────────┬─────────────┤
│   Casa      │   Empate    │    Fora     │    ROI      │
│   2.05      │    3.40     │    2.75     │   -3.1%     │
│  Superbet   │   Betano    │   KTO       │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/OddsMonitor.tsx` | Atualizar `MatchCard` para exibir 2 seções de odds |
| `src/components/OddsComparisonTable.tsx` | Mesma atualização para o componente alternativo |
| `src/index.css` | Adicionar variáveis CSS para cores SO/PA |

## Implementação Técnica

### 1. Adicionar variáveis de cor no CSS (index.css)

Novas variáveis semânticas:

```css
:root {
  /* Odds Type Colors */
  --odds-so: 38 92% 50%;          /* Laranja/amber */
  --odds-so-foreground: 0 0% 100%;
  --odds-pa: 142 76% 36%;         /* Verde */
  --odds-pa-foreground: 0 0% 100%;
}

.dark {
  --odds-so: 38 80% 55%;
  --odds-so-foreground: 0 0% 0%;
  --odds-pa: 142 70% 45%;
  --odds-pa-foreground: 0 0% 100%;
}
```

### 2. Função utilitária para separar odds por tipo

```typescript
function getBestOddsByType(odds: BookmakerOdds[], isBasketball: boolean) {
  const knownSOBookmakers = ['novibet', 'betbra', 'betnacional'];
  
  const soOdds = odds.filter(o => {
    const name = o.bookmaker_name.toLowerCase();
    return o.odds_type === 'SO' || knownSOBookmakers.some(b => name.includes(b));
  });
  
  const paOdds = odds.filter(o => {
    const name = o.bookmaker_name.toLowerCase();
    return o.odds_type !== 'SO' && !knownSOBookmakers.some(b => name.includes(b));
  });
  
  // Melhores SO
  const bestSO = {
    home: Math.max(...soOdds.map(o => o.home_odd), 0),
    draw: isBasketball ? null : Math.max(...soOdds.map(o => o.draw_odd || 0), 0),
    away: Math.max(...soOdds.map(o => o.away_odd), 0),
    homeBookmaker: soOdds.find(o => o.home_odd === Math.max(...soOdds.map(x => x.home_odd)))?.bookmaker_name,
    drawBookmaker: soOdds.find(o => o.draw_odd === Math.max(...soOdds.map(x => x.draw_odd || 0)))?.bookmaker_name,
    awayBookmaker: soOdds.find(o => o.away_odd === Math.max(...soOdds.map(x => x.away_odd)))?.bookmaker_name,
  };
  
  // Top 3 PA por outcome
  const getTopN = (arr: BookmakerOdds[], key: 'home_odd' | 'draw_odd' | 'away_odd', n: number) => {
    return [...arr]
      .filter(o => key === 'draw_odd' ? o[key] !== null : true)
      .sort((a, b) => (b[key] || 0) - (a[key] || 0))
      .slice(0, n);
  };
  
  const topPAHome = getTopN(paOdds, 'home_odd', 3);
  const topPADraw = isBasketball ? [] : getTopN(paOdds, 'draw_odd', 3);
  const topPAAway = getTopN(paOdds, 'away_odd', 3);
  
  return { bestSO, topPAHome, topPADraw, topPAAway, hasSOData: soOdds.length > 0, hasPAData: paOdds.length > 0 };
}
```

### 3. Atualizar MatchCard no OddsMonitor.tsx

Substituir o grid único por duas seções condicionais:

```tsx
{/* SO / Betbra Section - Laranja */}
{hasSOData && (
  <div className="space-y-1">
    <div className="text-xs font-medium text-amber-500 flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
      SO / Betbra
    </div>
    <div className="grid grid-cols-4 gap-2 bg-amber-500/5 rounded-lg p-2 border border-amber-500/20">
      {/* Casa */}
      <OddsCell 
        value={bestSO.home} 
        label="Casa" 
        bookmaker={bestSO.homeBookmaker}
        colorClass="text-amber-500"
      />
      {/* Empate (se futebol) */}
      {!isBasketball && (
        <OddsCell 
          value={bestSO.draw} 
          label="Empate" 
          bookmaker={bestSO.drawBookmaker}
          colorClass="text-amber-500"
        />
      )}
      {/* Fora */}
      <OddsCell 
        value={bestSO.away} 
        label="Fora" 
        bookmaker={bestSO.awayBookmaker}
        colorClass="text-amber-500"
      />
      {/* ROI SO */}
      <ROICell value={roiSO} colorClass="text-amber-500" />
    </div>
  </div>
)}

{/* PA Section - Verde */}
{hasPAData && (
  <div className="space-y-1">
    <div className="text-xs font-medium text-emerald-500 flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
      PA - Top 3
    </div>
    <div className="grid grid-cols-4 gap-2 bg-emerald-500/5 rounded-lg p-2 border border-emerald-500/20">
      {/* Casa - mostra até 3 valores */}
      <div className="text-center">
        {topPAHome.slice(0, 3).map((o, i) => (
          <div key={i} className="text-xs">
            <span className="font-mono font-bold text-emerald-500">{o.home_odd.toFixed(2)}</span>
            <span className="text-muted-foreground ml-1">{o.bookmaker_name.slice(0, 8)}</span>
          </div>
        ))}
        <div className="text-[10px] text-muted-foreground">Casa</div>
      </div>
      {/* Empate */}
      {!isBasketball && (
        <div className="text-center">
          {topPADraw.slice(0, 3).map((o, i) => (
            <div key={i} className="text-xs">
              <span className="font-mono font-bold text-emerald-500">{o.draw_odd?.toFixed(2)}</span>
              <span className="text-muted-foreground ml-1">{o.bookmaker_name.slice(0, 8)}</span>
            </div>
          ))}
          <div className="text-[10px] text-muted-foreground">Empate</div>
        </div>
      )}
      {/* Fora */}
      <div className="text-center">
        {topPAAway.slice(0, 3).map((o, i) => (
          <div key={i} className="text-xs">
            <span className="font-mono font-bold text-emerald-500">{o.away_odd.toFixed(2)}</span>
            <span className="text-muted-foreground ml-1">{o.bookmaker_name.slice(0, 8)}</span>
          </div>
        ))}
        <div className="text-[10px] text-muted-foreground">Fora</div>
      </div>
      {/* ROI PA (melhor combinação) */}
      <ROICell value={roiPA} colorClass="text-emerald-500" />
    </div>
  </div>
)}
```

### 4. Cores utilizadas

| Tipo | Cor Principal | Background | Border |
|------|---------------|------------|--------|
| SO/Betbra | `text-amber-500` | `bg-amber-500/5` | `border-amber-500/20` |
| PA | `text-emerald-500` | `bg-emerald-500/5` | `border-emerald-500/20` |

## Layout Final Esperado

Para cada card de partida:

```text
┌────────────────────────────────────────────────────────────┐
│ Flamengo ⚽ x ⚽ Palmeiras                    🎯 SUREBET    │
│ Brasileirão Série A                      AO VIVO          │
│ 15/02/2025 16:00                                          │
├────────────────────────────────────────────────────────────┤
│ ● SO / Betbra                                              │
│ ┌──────────┬──────────┬──────────┬──────────┐             │
│ │  2.10    │   3.50   │   2.80   │  -2.5%   │  (laranja)  │
│ │  Betbra  │  Novibet │  Betbra  │   ROI    │             │
│ │  Casa    │  Empate  │   Fora   │          │             │
│ └──────────┴──────────┴──────────┴──────────┘             │
│                                                            │
│ ● PA - Top 3                                               │
│ ┌──────────┬──────────┬──────────┬──────────┐             │
│ │  2.05    │   3.40   │   2.75   │  -3.1%   │  (verde)    │
│ │ Superbet │  Betano  │   KTO    │   ROI    │             │
│ │  2.03    │   3.38   │   2.72   │          │             │
│ │  Betano  │   KTO    │  Betano  │          │             │
│ │  2.00    │   3.35   │   2.70   │          │             │
│ │ Estrel.. │ Sportng  │ Estrel.. │          │             │
│ │  Casa    │  Empate  │   Fora   │          │             │
│ └──────────┴──────────┴──────────┴──────────┘             │
└────────────────────────────────────────────────────────────┘
```

## Resumo das Mudanças

| Arquivo | Linhas Afetadas | Tipo |
|---------|-----------------|------|
| `src/index.css` | +8 linhas | Novas variáveis CSS |
| `src/components/OddsMonitor.tsx` | ~80 linhas modificadas | Nova estrutura MatchCard |
| `src/components/OddsComparisonTable.tsx` | ~60 linhas modificadas | Consistência visual |

## Comportamento

- Se não houver odds SO disponíveis, só mostra a seção PA
- Se não houver odds PA disponíveis, só mostra a seção SO
- ROI calculado separadamente para cada tipo
- Basquete oculta coluna de empate automaticamente
