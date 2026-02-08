

# Revisao Geral: Reset de Odds + Links br4bet/jogodeouro + Estrelabet PA/SO

## Diagnostico

Tracei todo o pipeline para os tres problemas:

### 1. Links br4bet e jogodeouro sumiram

A funcao `generateBookmakerLink` em `MatchDetails.tsx` depende do campo `extra_data` de cada odd. Se `extra_data` for `null` ou `{}`, nenhum link e gerado. Possivel causa: a query de reparo de dados (`UPDATE is_latest`) pode ter promovido registros antigos (sem extra_data) como "mais recentes", sobrescrevendo os que tinham links.

Alem disso, existe um risco de nome: se o bookmaker no banco for "jogo de ouro" (com espacos), o check `name.includes('jogodeouro')` falha. O frontend precisa tratar ambas as variantes.

### 2. Estrelabet PA/SO nao aparece no frontend

O banco tem ambos PA e SO com `is_latest = TRUE` (confirmado pelo usuario). O trigger esta correto. O JSON generator inclui `extra_data` e `odds_type`. Se o JSON tem ambos e o frontend usa `key={bookmaker_id-odds_type}`, deveria renderizar ambos. O reset vai limpar qualquer dado inconsistente e permitir dados frescos.

### 3. Dados estranhos/inconsistentes

Apos multiplas correcoes de trigger e reparos de dados, o historico pode ter registros orfaos, duplicatas, ou records sem extra_data marcados como latest. Um reset limpo e a melhor abordagem.

---

## Plano de Acao

### Parte 1: SQL para resetar TODOS os dados de odds (executar no Supabase SQL Editor)

```sql
-- RESET COMPLETO DE ODDS (futebol + NBA)
-- Isso vai limpar o frontend imediatamente

-- 1. Deletar todas as odds de futebol
DELETE FROM public.odds_history;

-- 2. Deletar todas as odds de NBA
DELETE FROM public.nba_odds_history;

-- 3. Deletar todos os alertas (dependem de partidas)
DELETE FROM public.alerts;

-- Verificar que ficou vazio:
SELECT 'odds_history' AS tabela, COUNT(*) FROM odds_history
UNION ALL
SELECT 'nba_odds_history', COUNT(*) FROM nba_odds_history
UNION ALL
SELECT 'alerts', COUNT(*) FROM alerts;
```

Isso vai:
- Limpar todas as odds (o frontend mostrara 0 partidas apos o JSON generator rodar)
- Manter as partidas, times, ligas, aliases (nao precisa recriar)
- Apos 1-2 ciclos dos scrapers (~40 segundos), dados frescos com `extra_data` correto vao aparecer
- O JSON generator vai gerar um `odds.json` vazio e depois um com dados novos

### Parte 2: Frontend - Corrigir links br4bet e jogodeouro (MatchDetails.tsx)

Tornar o matching de nomes mais robusto para cobrir variantes com/sem espaco:

**Arquivo: `src/pages/MatchDetails.tsx`**

Dentro de `generateBookmakerLink`, linhas 115 e 276:

```typescript
// Antes (linha 115):
if (name.includes('br4bet')) {

// Depois (sem mudanca necessaria - br4bet e sempre uma palavra):
if (name.includes('br4bet')) {

// Antes (linha 276):
if (name.includes('jogodeouro')) {

// Depois (cobrir "jogo de ouro" e "jogodeouro"):
if (name.includes('jogodeouro') || name.includes('jogo de ouro')) {
```

E na mesma funcao, adicionar fallback para `jogodeouro_event_id` OU `event_id`:

```typescript
// Antes:
const eventId = extraData.jogodeouro_event_id;

// Depois:
const eventId = extraData.jogodeouro_event_id || extraData.event_id;
```

Mesma correcao no arquivo `src/lib/bookmakerLinks.ts` (funcao duplicada).

### Parte 3: Frontend - Corrigir getOddsType fallback (MatchDetails.tsx)

**Arquivo: `src/pages/MatchDetails.tsx`**, linha 319:

```typescript
// Antes:
if (name.includes('novibet') || name.includes('betbra')) {

// Depois:
if (name.includes('novibet') || name.includes('betbra') || name.includes('betnacional') || name.includes('tradeball')) {
```

### Parte 4: Frontend - Adicionar log de debug temporario

Para diagnosticar se `extra_data` chega ao frontend, adicionar um `console.log` temporario no `OddsRow` que mostra o extra_data de br4bet e jogodeouro:

```typescript
// Em OddsRow, apos a linha 315:
if (odds.bookmaker_name.toLowerCase().includes('br4bet') || 
    odds.bookmaker_name.toLowerCase().includes('jogo')) {
  console.log(`[DEBUG] ${odds.bookmaker_name} extra_data:`, odds.extra_data);
}
```

Isso aparecera no console do navegador e permitira verificar se `extra_data` esta chegando com os campos esperados.

---

## Resumo das mudancas

| O que | Onde | Mudanca |
|---|---|---|
| Reset completo de odds | Supabase SQL Editor | DELETE de odds_history, nba_odds_history, alerts |
| Link jogodeouro robusto | `src/pages/MatchDetails.tsx` linha 276 | Adicionar `name.includes('jogo de ouro')` |
| Link jogodeouro fallback | `src/pages/MatchDetails.tsx` linha 277 | Adicionar `extraData.event_id` como fallback |
| Link jogodeouro (lib) | `src/lib/bookmakerLinks.ts` linha 177 | Mesma correcao |
| getOddsType fallback | `src/pages/MatchDetails.tsx` linha 319 | Adicionar betnacional e tradeball |
| Debug log temporario | `src/pages/MatchDetails.tsx` OddsRow | console.log para extra_data |

## Sequencia de deploy

```text
1. Supabase SQL Editor:
   - Executar o DELETE de odds_history, nba_odds_history e alerts
   - Verificar que as tabelas ficaram vazias

2. Frontend (automatico via Lovable):
   - Publicar apos aprovacao

3. VPS:
   - Os scrapers ja estao rodando e vao popular dados frescos
   - Aguardar 1-2 ciclos (~40 segundos)
   - O JSON generator vai gerar odds.json com dados novos

4. Verificacao:
   - Abrir qualquer partida no frontend
   - Verificar console do navegador para logs "[DEBUG] br4bet extra_data:"
   - Se extra_data tiver br4bet_event_id, os icones devem aparecer
   - Se extra_data for null/vazio, o problema esta no scraper ou orchestrator
   - Verificar Estrelabet aparecendo com PA e SO separados
```

