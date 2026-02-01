
# Separar Melhores Odds por Tipo (SO vs PA) - MatchDetails

## Entendimento

Na seção "Melhores Odds" da página de detalhes da partida:
- Atualmente: mostra as melhores odds gerais com destaque verde
- Desejado: separar em duas seções distintas com cores diferentes

## Tipos de Odds

| Tipo | Casas | Cor |
|------|-------|-----|
| **SO** | Betbra + Novibet + Betnacional + qualquer casa com `odds_type === 'SO'` (Betano SO, KTO SO, Tradeball SO, Stake SO) | **Laranja/Amber** |
| **PA** | Todas as outras (Estrelabet, Superbet, Br4bet, McGames, etc.) | **Verde** (mantém) |

## Exemplo da Imagem (Betis x Valencia)

**Melhores SO (laranja):**
- Casa: 1.86 (Betbra) ou 1.85 (Betano/KTO/Tradeball)
- Empate: 3.75 (Betbra)
- Fora: 5.00 (Betbra)

**Melhores PA (verde):**
- Casa: 1.87 (Estrelabet)
- Empate: 3.67 (Estrelabet)
- Fora: 4.60 (Superbet/Betano)

## Layout Proposto

```text
┌────────────────────────────────────────────────────────────┐
│                     Melhores Odds                          │
├────────────────────────────────────────────────────────────┤
│ ● SO / Betbra                                              │
│ ┌──────────┬──────────┬──────────┬──────────┐             │
│ │  Betbra  │  Betbra  │  Betbra  │   ROI    │ (laranja)   │
│ │   1.86   │   3.75   │   5.00   │  +0.XX%  │             │
│ │   Casa   │  Empate  │   Fora   │          │             │
│ └──────────┴──────────┴──────────┴──────────┘             │
│                                                            │
│ ● PA                                                       │
│ ┌──────────┬──────────┬──────────┬──────────┐             │
│ │ Estrela  │ Estrela  │ Superbet │   ROI    │ (verde)     │
│ │   1.87   │   3.67   │   4.60   │  -X.XX%  │             │
│ │   Casa   │  Empate  │   Fora   │          │             │
│ └──────────┴──────────┴──────────┴──────────┘             │
└────────────────────────────────────────────────────────────┘
```

## Arquivo a Modificar

`src/pages/MatchDetails.tsx`

## Implementação

### 1. Importar utilitários existentes

```typescript
import { getBestOddsByType, calculateROI, getBestPAOdds } from '@/lib/oddsTypeUtils';
```

### 2. Adicionar lógica para separar odds (após linha 533)

```typescript
// Separar odds por tipo (SO vs PA)
const { bestSO, topPAHome, topPADraw, topPAAway, hasSOData, hasPAData, paOdds } = 
  getBestOddsByType(match.odds, isBasketball);

// Calcular ROI separado para SO
const roiSO = hasSOData 
  ? calculateROI(bestSO.home, bestSO.draw, bestSO.away, isBasketball) 
  : -100;

// Calcular ROI para PA (usando melhores PA)
const bestPA = getBestPAOdds(paOdds, isBasketball);
const roiPA = hasPAData 
  ? calculateROI(bestPA.home, bestPA.draw, bestPA.away, isBasketball) 
  : -100;
```

### 3. Substituir seção "Melhores Odds" (linhas 579-620)

Trocar o Card único por duas seções condicionais dentro do mesmo Card:

**Seção SO (laranja):**
- Header: `● SO / Betbra` com bolinha laranja
- Background: `bg-amber-500/5`
- Border: `border border-amber-500/20`
- Texto de odds: `text-amber-500`
- Mostra: bestSO.home, bestSO.draw, bestSO.away, roiSO

**Seção PA (verde):**
- Header: `● PA` com bolinha verde
- Background: `bg-emerald-500/5`
- Border: `border border-emerald-500/20`
- Texto de odds: `text-emerald-500`
- Mostra: bestPA.home, bestPA.draw, bestPA.away, roiPA

### 4. Comportamento

- Se não houver odds SO: mostra apenas seção PA
- Se não houver odds PA: mostra apenas seção SO
- Basquete: oculta coluna Empate automaticamente
- Cada seção tem seu próprio ROI calculado
- Ambas seções ficam dentro do mesmo Card "Melhores Odds"

## Resumo das Mudanças

| Linha | Mudança |
|-------|---------|
| ~3 | Adicionar import de `getBestOddsByType`, `calculateROI`, `getBestPAOdds` |
| ~534 | Adicionar lógica para separar odds e calcular ROIs |
| 579-620 | Substituir grid único por duas seções (SO laranja + PA verde) |

## Nota

A tabela "Todas as Casas de Apostas" continua igual - ela já mostra os badges SO/PA em cada linha. A mudança é apenas na seção resumo "Melhores Odds" no topo.
