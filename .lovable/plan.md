
# Adicionar Cores por Tipo de Odds na Tabela

## Problema Identificado

Na tabela "Todas as Casas de Apostas", as melhores odds são destacadas apenas em verde, independentemente do tipo (SO ou PA). O usuário quer:

- **SO/Betbra** → Destacar melhores odds em **laranja/amber**
- **PA** → Destacar melhores odds em **verde/emerald** (como já está)

## Layout Atual vs Desejado

```text
Atual:                              Desejado:
┌────────┬───────┬───────┬───────┐  ┌────────┬───────┬───────┬───────┐
│ Betbra │ 1.84  │ 3.75  │ 5.00  │  │ Betbra │ 1.84  │ 3.75  │ 5.00  │
│   SO   │       │ verde │ verde │  │   SO   │       │laranja│laranja│
├────────┼───────┼───────┼───────┤  ├────────┼───────┼───────┼───────┤
│Estrela │ 1.87  │ 3.67  │ 4.50  │  │Estrela │ 1.87  │ 3.67  │ 4.50  │
│   PA   │ verde │ verde │       │  │   PA   │ verde │ verde │       │
└────────┴───────┴───────┴───────┘  └────────┴───────┴───────┴───────┘
```

## Arquivo a Modificar

`src/pages/MatchDetails.tsx`

## Mudanças Técnicas

### 1. Atualizar componente OddCell (linha 400)

Adicionar parâmetro `oddsType` para determinar a cor:

```typescript
function OddCell({ 
  value, 
  isBest, 
  isWorst, 
  oddsType 
}: { 
  value: number | null; 
  isBest: boolean; 
  isWorst: boolean;
  oddsType?: 'SO' | 'PA';
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  // Escolher cor baseado no tipo de odd
  const bestColorClass = oddsType === 'SO' 
    ? "bg-amber-500/10 text-amber-500 font-bold"
    : "bg-emerald-500/10 text-emerald-500 font-bold";
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1 px-2 py-1 rounded font-mono",
      isBest && bestColorClass
    )}>
      {value.toFixed(2)}
    </div>
  );
}
```

### 2. Atualizar chamadas de OddCell em OddsRow (linhas 343-352)

Passar o `oddsType` determinado para cada célula:

```typescript
<TableCell className="text-center">
  <OddCell 
    value={odds.home_odd} 
    isBest={odds.home_odd === bestHome} 
    isWorst={odds.home_odd === worstHome}
    oddsType={oddsType}  // Adicionar
  />
</TableCell>
{!isBasketball && (
  <TableCell className="text-center">
    <OddCell 
      value={odds.draw_odd} 
      isBest={odds.draw_odd === bestDraw} 
      isWorst={odds.draw_odd === worstDraw}
      oddsType={oddsType}  // Adicionar
    />
  </TableCell>
)}
<TableCell className="text-center">
  <OddCell 
    value={odds.away_odd} 
    isBest={odds.away_odd === bestAway} 
    isWorst={odds.away_odd === worstAway}
    oddsType={oddsType}  // Adicionar
  />
</TableCell>
```

## Comportamento Final

| Tipo Odd | Badge | Cor Destaque Melhor Odd |
|----------|-------|-------------------------|
| SO | Laranja | `bg-amber-500/10 text-amber-500` |
| PA | Verde | `bg-emerald-500/10 text-emerald-500` |

## Exemplo Visual Esperado

Na imagem enviada:
- **Betbra SO**: 3.75 (Empate) e 5.00 (Fora) → destaque **laranja**
- **Estrelabet PA**: 1.87 (Casa) → destaque **verde**
- **kto SO**: 1.89 (Casa) → destaque **laranja** (é a melhor odd de Casa)

## Resumo das Mudanças

| Linha | Mudança |
|-------|---------|
| 400-413 | Atualizar `OddCell` para receber `oddsType` e usar cor correspondente |
| 343-352 | Passar `oddsType` nas 3 chamadas de `OddCell` dentro de `OddsRow` |

A lógica de detecção do tipo já existe na linha 325 (`const oddsType = odds.odds_type || getOddsType(odds.bookmaker_name)`), apenas precisamos propagar para o `OddCell`.
