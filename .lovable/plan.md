
# Nova Aba: Extração Freebet

## Visao Geral da Funcionalidade

A "Extracao Freebet" e uma estrategia de arbitragem especifica que utiliza:
- **Casa (Home)**: Sempre aposta PA (Pagamento Antecipado)
- **Empate (Draw)**: Sempre aposta SO (preferencialmente Betbra)
- **Visitante (Away)**: Sempre aposta PA (Pagamento Antecipado)

A ideia e extrair o valor de freebets apostando em todos os resultados possiveis com casas diferentes.

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/FreebetExtraction.tsx` | Pagina principal do monitor |
| `src/components/freebet/FreebetCard.tsx` | Card individual de cada partida |
| `src/components/freebet/FreebetFilters.tsx` | Modal/popover de filtros |
| `src/components/freebet/FreebetConfig.tsx` | Barra de configuracao (casa selecionada, valor) |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/types/auth.ts` | Adicionar `FREEBET_EXTRACTION` ao `PAGE_KEYS` |
| `src/components/Sidebar.tsx` | Adicionar link para nova pagina |
| `src/components/AnimatedRoutes.tsx` | Adicionar rota `/freebet-extraction` |

## Layout da Pagina Principal

```text
+----------------------------------------------------------+
|  Configuracao da Freebet                    28 casas     |
+----------------------------------------------------------+
|  [Dropdown Casa]     [Valor R$]  [Filtros]  [Pesquisar]  |
+----------------------------------------------------------+

+----------------------+  +----------------------+  +-----...
|  Team A vs Team B    |  |  Team C vs Team D    |  |
|  Premier League      |  |  La Liga             |
|  15:30 - 01/02/2026  |  |  18:00 - 01/02/2026  |
|  [1926.1% ROI]       |  |  [796.2% ROI]        |
|                      |  |                      |
|  Total: R$ 87.39     |  |  Total: R$ 15.38     |
|  Lucro: R$ 192.61    |  |  Lucro: R$ 79.62     |
|                      |  |                      |
|  Novibet (Casa PA)   |  |  Novibet (Casa PA)   |
|  29.00  R$ 74.67     |  |  10.50  R$ 15.00     |
|                      |  |                      |
|  Betbra SO (Empate)  |  |  Betbra SO (Empate)  |
|  3.75   R$ 10.00     |  |  6.33   R$ 10.00     |
|                      |  |                      |
|  Novibet (Fora PA)   |  |  Betano (Fora PA)    |
|  22.00  R$ 12.73     |  |  250.00 R$ 0.38      |
|                      |  |                      |
|  [Link Casa] [Link]  |  |  [Link Casa] [...]   |
+----------------------+  +----------------------+
```

## Logica de Calculo Freebet

### 1. Selecao de Odds

Para cada partida, o sistema seleciona:
- **Casa**: Melhor odd PA para Casa (ex: Novibet 29.00)
- **Empate**: Melhor odd SO (priorizando Betbra)
- **Fora**: Melhor odd PA para Fora (ex: Novibet 22.00)

### 2. Calculo de Arbitragem

```typescript
// Calculo do valor de arbitragem para freebet
function calculateFreebetArbitrage(
  homeOdd: number, 
  drawOdd: number, 
  awayOdd: number,
  freebetValue: number
): FreebetResult {
  // Valor base da aposta no empate (freebet)
  const drawStake = freebetValue;
  
  // Calcular valor total necessario para cobrir todos os resultados
  const arbitrageValue = 1/homeOdd + 1/drawOdd + 1/awayOdd;
  
  // ROI (quanto maior, melhor)
  const roi = ((1 / arbitrageValue) - 1) * 100;
  
  // Stakes otimas
  const totalToInvest = drawStake * drawOdd / (1 / arbitrageValue);
  const homeStake = (1/homeOdd) / arbitrageValue * totalToInvest;
  const awayStake = (1/awayOdd) / arbitrageValue * totalToInvest;
  
  // Lucro garantido
  const guaranteedProfit = (totalToInvest / arbitrageValue) - totalToInvest;
  
  return {
    roi,
    totalToInvest,
    guaranteedProfit,
    homeStake,
    drawStake,
    awayStake,
  };
}
```

### 3. Filtros Disponiveis

| Filtro | Tipo | Descricao |
|--------|------|-----------|
| Casa da Freebet | Dropdown | Qual casa tem a freebet (Betbra, Novibet, etc) |
| Valor Freebet | Input | Valor em R$ da freebet (ex: 10) |
| Casas de Apostas PA | Checkbox | Quais casas PA considerar |
| Campeonatos | Checkbox | Filtrar por liga |
| Datas | Checkbox | Filtrar por data |
| Odd Min/Max | Input | Range de odds da freebet |

## Componentes Detalhados

### FreebetCard

```typescript
interface FreebetOpportunity {
  match: MatchOddsGroup;
  homeBookmaker: string;
  homeOdd: number;
  homeStake: number;
  homeLink: string | null;
  drawBookmaker: string;  // Sempre SO, preferencia Betbra
  drawOdd: number;
  drawStake: number;      // Valor da freebet
  drawLink: string | null;
  awayBookmaker: string;
  awayOdd: number;
  awayStake: number;
  awayLink: string | null;
  totalToInvest: number;
  guaranteedProfit: number;
  roi: number;
}
```

### FreebetConfig (barra superior)

```typescript
interface FreebetConfigState {
  selectedBookmaker: string;  // Casa onde tem a freebet
  freebetValue: number;       // Valor da freebet em R$
}
```

## Integracao com Dados Existentes

O hook `useOddsComparison` ja retorna os dados agrupados por partida com:
- `match.odds[]` - Todas as odds de todas as casas
- `odds.odds_type` - 'SO' ou 'PA'
- `odds.bookmaker_name` - Nome da casa
- `odds.extra_data` - Dados para gerar links

Utilizaremos `getBestOddsByType` de `oddsTypeUtils.ts` para separar odds SO e PA.

## Fluxo de Uso

1. Usuario seleciona qual casa tem a freebet (ex: "Betbra")
2. Usuario informa o valor da freebet (ex: R$ 10)
3. Sistema calcula automaticamente todas as oportunidades
4. Cards mostram ROI, valores a apostar e lucro garantido
5. Botoes com links abrem a pagina da aposta em cada casa

## Ordenacao

Os cards serao ordenados por ROI (maior para menor), mostrando as melhores oportunidades primeiro.

## Elementos Visuais

| Elemento | Estilo |
|----------|--------|
| Badge ROI | Verde/roxo com % |
| Casa PA | Cor verde |
| Empate SO | Cor laranja/amber |
| Links | Botoes com icone ExternalLink |
| Horario | Formato HH:mm DD/MM |
| Liga | Badge ou texto pequeno |
