
# Corrigir Destaque de Melhores Odds por Grupo (SO vs PA)

## Problema Atual

O código está passando `match.best_home`, `match.best_draw`, `match.best_away` para TODAS as linhas da tabela. Isso significa que está comparando odds globais, não por grupo.

**Exemplo da imagem:**
- Betbra SO tem Casa 1.85 → está destacado em laranja (correto!)
- Betano SO tem Empate 3.65 e Fora 5.20 → destacados em laranja (correto!)
- Sportingbet PA tem Casa 1.78 → deveria ser verde (melhor PA Casa)
- Mas 1.85 > 1.78, então 1.78 não é "isBest" usando comparação global

## Solução

Calcular as melhores odds **separadas por grupo**:

| Grupo | Odds a Comparar | Cor |
|-------|-----------------|-----|
| SO + Betbra | Apenas SO e Betbra | Laranja |
| PA | Apenas PA | Verde |

## Mudanças Técnicas

### 1. Calcular melhores odds por grupo (antes da tabela)

Usar `getBestOddsByType` para obter:
- `bestSO.home`, `bestSO.draw`, `bestSO.away` → melhores dentro do grupo SO
- `bestPAValues.home`, `bestPAValues.draw`, `bestPAValues.away` → melhores dentro do grupo PA

### 2. Atualizar props do OddsRow

Ao invés de passar apenas `bestHome`, `bestDraw`, `bestAway` globais, passar os valores específicos do grupo:

```typescript
<OddsRow 
  odds={odds} 
  bestHome={isSOType ? bestSO.home : bestPA.home}
  bestDraw={isSOType ? bestSO.draw : bestPA.draw}
  bestAway={isSOType ? bestSO.away : bestPA.away}
  // ... resto igual
/>
```

### 3. Arquivo: `src/pages/MatchDetails.tsx`

**Linha ~812-851** - Onde o mapeamento das odds acontece:

Adicionar lógica para determinar o tipo de cada odd e passar os valores corretos de comparação:

```typescript
{(() => {
  const { sorted, betbraEnd, paEnd } = sortBookmakerOdds(match.odds);
  
  // Calcular melhores por tipo
  const { bestSO, paOdds } = getBestOddsByType(match.odds, isBasketball);
  const bestPA = getBestPAOdds(paOdds, isBasketball);
  
  // Também precisamos do bookmaker para best PA
  const bestPAHomeBookmaker = paOdds.find(o => o.home_odd === bestPA.home)?.bookmaker_name;
  const bestPADrawBookmaker = paOdds.find(o => o.draw_odd === bestPA.draw)?.bookmaker_name;
  const bestPAAwayBookmaker = paOdds.find(o => o.away_odd === bestPA.away)?.bookmaker_name;
  
  const colSpan = isBasketball ? 4 : 5;
  
  return sorted.map((odds, index) => {
    // Determinar tipo da odd atual
    const name = odds.bookmaker_name.toLowerCase();
    const isSOType = odds.odds_type === 'SO' || 
      ['novibet', 'betbra', 'betnacional'].some(b => name.includes(b));
    
    // Passar melhores do grupo correspondente
    elements.push(
      <OddsRow 
        key={...}
        odds={odds} 
        bestHome={isSOType ? bestSO.home : bestPA.home}
        bestDraw={isSOType ? bestSO.draw : bestPA.draw}
        bestAway={isSOType ? bestSO.away : bestPA.away}
        worstHome={match.worst_home}
        worstDraw={match.worst_draw}
        worstAway={match.worst_away}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        isBasketball={isBasketball}
      />
    );
  });
})()}
```

## Resultado Esperado

| Casa | Tipo | Casa (1) | Empate (X) | Fora (2) |
|------|------|----------|------------|----------|
| Betbra | SO | **1.85** (laranja) | 3.60 | **5.20** (laranja) |
| Betano | SO | 1.80 | **3.65** (laranja) | **5.20** (laranja) |
| sportingbet | PA | **1.78** (verde) | 3.50 | 4.75 |
| jogodeouro | PA | 1.75 | **3.60** (verde) | 4.75 |
| esportivabet | PA | 1.76 | 3.60 | **5.00** (verde) |

Cada grupo terá suas próprias melhores odds destacadas na cor correspondente.

## Resumo das Mudanças

| Arquivo | Linhas | Mudança |
|---------|--------|---------|
| `src/pages/MatchDetails.tsx` | ~812-851 | Calcular `bestSO` e `bestPA` separados, passar valores corretos para cada `OddsRow` baseado no tipo |
