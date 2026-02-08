
# Correcao: Links br4bet + Estrelabet PA/SO dupla

## Diagnostico Completo

Tracei todo o pipeline desde o scraper ate o frontend para ambos os problemas.

### Problema 1: Link da br4bet nao aparece

**Pipeline verificado:**
- Scraper: Correto - seta `extra_data = {"br4bet_event_id": "...", "br4bet_country": "..."}` (linhas 407-410 do `br4bet_scraper.py`)
- Orchestrator: Correto - passa `extra_data: odds.extra_data or {}` (linha 507)
- Database: Correto - coluna JSONB com default `{}`
- View: Correto - inclui `oh.extra_data`
- JSON Generator: Correto - inclui `row.get("extra_data")`
- Frontend: Verifica `extraData.br4bet_event_id` (linhas 115-123)

**Causa provavel**: Apos o UPDATE de `is_latest` que fizemos anteriormente, registros antigos sem `extra_data` (ou com `extra_data = {}`) foram promovidos como "mais recentes", e mesmo apos o reset, pode ser que os scrapers ainda nao tenham rodado um ciclo completo. Alem disso, falta um fallback para `event_id` (como fizemos com jogodeouro).

**Correcao**: Adicionar fallback `event_id` no br4bet e melhorar o debug.

### Problema 2: Estrelabet mostra apenas PA ou SO, nunca ambos

**Pipeline verificado:**
- Database: Confirmado - 141 PA + 19 SO com `is_latest = TRUE`
- View `odds_comparison`: Inclui `odds_type` e retorna ambos
- JSON Generator (`run_json_generator.py`): NAO faz deduplicacao - apenas appenda todas as odds por match (linha 132: `group["odds"].append(bookmaker_odds)`)
- Frontend `sortBookmakerOdds`: Separa corretamente PA e SO com base em `odds.odds_type`
- React key: `${bookmaker_id}-${odds.odds_type ?? 'PA'}` - chaves unicas

**O pipeline inteiro parece correto!** O problema pode ser:
1. O `odds.json` no Storage NAO contem ambos os tipos (verificar com curl)
2. Os dados no JSON estao corretos mas a renderizacao tem um bug sutil
3. `odds_type` esta chegando como `null` para ambos os registros, fazendo ambas as keys serem `uuid-PA`

**Correcao**: Adicionar debug logging detalhado + verificar se o JSON realmente contem ambos os tipos.

---

## Mudancas no Frontend

### 1. `src/pages/MatchDetails.tsx` - Link br4bet com fallback

Linha 115-123: Adicionar fallback para `event_id` (caso o scraper use outra chave):

```typescript
if (name.includes('br4bet')) {
    const eventId = extraData.br4bet_event_id || extraData.event_id;
    const country = (extraData.br4bet_country || extraData.country || 'italia') as string;
    if (eventId && homeTeam && awayTeam) {
```

### 2. `src/lib/bookmakerLinks.ts` - Mesma correcao do br4bet

Linha 47-55: Mesma logica de fallback:

```typescript
if (name.includes('br4bet')) {
    const eventId = extraData.br4bet_event_id || extraData.event_id;
    const country = (extraData.br4bet_country || extraData.country || 'italia') as string;
    if (eventId && homeTeam && awayTeam) {
```

### 3. `src/pages/MatchDetails.tsx` - Debug logging aprimorado

Substituir o debug atual (linhas 317-321) por um mais completo que cobre br4bet E Estrelabet:

```typescript
// Debug temporario - verificar extra_data e odds_type
if (odds.bookmaker_name.toLowerCase().includes('br4bet') || 
    odds.bookmaker_name.toLowerCase().includes('estrelabet')) {
  console.log(`[DEBUG] ${odds.bookmaker_name} | odds_type: ${odds.odds_type} | extra_data:`, odds.extra_data);
}
```

Isso vai mostrar no console:
- Se `extra_data` do br4bet tem `br4bet_event_id`
- Se `odds_type` da Estrelabet esta chegando como "PA" e "SO" (ou ambos null)

### 4. `src/pages/MatchDetails.tsx` - Protecao contra odds_type null

Na funcao `sortBookmakerOdds` (linha 31), garantir que `odds_type` null nao cause duplicatas:

```typescript
// Na linha 31, dentro do forEach:
const oddsType = odd.odds_type || (knownSOBookmakers.some(b => name.includes(b)) ? 'SO' : 'PA');
```

Este codigo ja existe e esta correto. Mas a key do React na linha 852 precisa ser mais robusta:

```typescript
// Antes (linha 852):
key={`${odds.bookmaker_id}-${odds.odds_type ?? 'PA'}`}

// Depois (incluir index como fallback de seguranca):
key={`${odds.bookmaker_id}-${odds.odds_type ?? 'PA'}-${index}`}
```

Isso garante que mesmo se dois registros tiverem a mesma combinacao bookmaker_id + odds_type (por um bug), ambos vao renderizar.

---

## SQL de Verificacao (para o usuario rodar no Supabase)

Apos o reset e 1-2 ciclos dos scrapers, rodar:

```sql
-- Verificar se br4bet tem extra_data preenchido
SELECT bookmaker_name, odds_type, extra_data 
FROM odds_comparison 
WHERE bookmaker_name ILIKE '%br4bet%' 
LIMIT 3;

-- Verificar se Estrelabet tem PA E SO
SELECT bookmaker_name, odds_type, COUNT(*) 
FROM odds_comparison 
WHERE bookmaker_name ILIKE '%estrelabet%' 
GROUP BY bookmaker_name, odds_type;
```

Se br4bet mostrar `extra_data: {}` ou `null`, o scraper nao esta enviando o event_id. Se Estrelabet mostrar apenas um odds_type, o trigger ou o scraper tem um bug.

---

## Resumo das mudancas por arquivo

| Arquivo | Linha | Mudanca |
|---|---|---|
| `src/pages/MatchDetails.tsx` | 116-117 | br4bet: fallback `event_id` e `country` |
| `src/pages/MatchDetails.tsx` | 317-321 | Debug log: incluir Estrelabet, remover jogodeouro |
| `src/pages/MatchDetails.tsx` | 852 | Key do React: adicionar index para seguranca |
| `src/lib/bookmakerLinks.ts` | 48-49 | br4bet: fallback `event_id` e `country` |

## Deploy

```text
1. Frontend: automatico via Lovable (publicar apos aprovacao)
2. Verificar console do navegador:
   - Abrir qualquer jogo com br4bet
   - Procurar "[DEBUG] br4bet | odds_type: PA | extra_data: {...}"
   - Se extra_data tiver br4bet_event_id, o link deve aparecer
   - Se extra_data for null/{}, o scraper nao esta enviando
3. Para Estrelabet:
   - Procurar "[DEBUG] Estrelabet | odds_type: PA | extra_data: {...}"
   - E "[DEBUG] Estrelabet | odds_type: SO | extra_data: {...}"
   - Se so aparecer UM tipo, o dados no JSON tem apenas um tipo
4. Rodar as queries SQL de verificacao
```
