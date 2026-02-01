
# Corrigir Cálculo de Extração e Renomear ROI

## Problema

O cálculo atual está errado:
- **Atual**: ROI = Lucro / Total Investido = 31,26 / 108,74 = **28.7%**
- **Correto**: Extração = Lucro / Valor Freebet = 31,26 / 50 = **62.5%**

A **Extração** representa quanto % do valor da freebet você está convertendo em dinheiro real.

## Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/types/freebet.ts` | Corrigir fórmula: `guaranteedProfit / freebetValue` |
| `src/types/freebet.ts` | Renomear campo `roi` para `extraction` nas interfaces |
| `src/lib/freebetUtils.ts` | Atualizar uso de `roi` para `extraction` |
| `src/components/freebet/FreebetCard.tsx` | Renomear "ROI" para "Extração" no badge |

## Detalhes Técnicos

### 1. `src/types/freebet.ts` - Corrigir Fórmula (linha 85-87)

De:
```typescript
// ROI = (lucro / total investido) * 100
const roi = totalOtherStakes > 0 ? (guaranteedProfit / totalOtherStakes) * 100 : 0;
```

Para:
```typescript
// Extração = (lucro / valor freebet) * 100
// Representa quanto % do valor da freebet estamos extraindo como lucro real
const extraction = freebetValue > 0 ? (guaranteedProfit / freebetValue) * 100 : 0;
```

### 2. Renomear interfaces

```typescript
export interface FreebetOpportunity {
  // ...
  extraction: number;  // Antes: roi
}

export interface FreebetCalculationResult {
  extraction: number;  // Antes: roi
  // ...
}
```

### 3. `src/components/freebet/FreebetCard.tsx` - Atualizar UI (linha 119, 165-175)

De:
```typescript
const { match, roi, totalToInvest, guaranteedProfit } = opportunity;
// ...
{roi.toFixed(1)}% ROI
```

Para:
```typescript
const { match, extraction, totalToInvest, guaranteedProfit } = opportunity;
// ...
{extraction.toFixed(1)}% Extração
```

### 4. `src/lib/freebetUtils.ts` - Atualizar ordenação

De:
```typescript
opportunities.sort((a, b) => b.roi - a.roi);
```

Para:
```typescript
opportunities.sort((a, b) => b.extraction - a.extraction);
```

## Verificação do Cálculo

Com os dados da imagem:
- Freebet: R$ 50 @ 3.80 (Fora)
- Retorno freebet = 50 × (3.80 - 1) = R$ 140
- Stake Casa = 140 / 2.02 = R$ 69,31
- Stake Empate = 140 / 3.55 = R$ 39,44
- Total investido = R$ 108,75
- Lucro = 140 - 108,75 = R$ 31,25
- **Extração = 31,25 / 50 × 100 = 62.5%** ✅
