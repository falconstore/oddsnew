

# Correcao: Highlighting de Odds e Bot Telegram Multi-Liga

## Problema 1: Monitor marcando odds menores como "melhores"

Na tabela de detalhes de uma partida, o sistema compara odds individuais com o melhor valor usando `===` (igualdade estrita). Quando existem valores como 1.65 e 1.66, o valor correto (1.66) deveria ser destacado, mas variacoes de precisao numerica no pipeline de dados (PostgreSQL DECIMAL -> JSON -> JavaScript Number) podem fazer `===` falhar.

### Correcao

Trocar a comparacao `===` por uma funcao de tolerancia que arredonda ambos os valores antes de comparar:

```
// Antes:
isBest={odds.away_odd === bestAway}

// Depois:
isBest={Math.round(odds.away_odd * 100) === Math.round(bestAway * 100)}
```

**Arquivos afetados:**
- `src/pages/MatchDetails.tsx` - Componente `OddCell`, linhas 344, 348, 352 (3 comparacoes: home, draw, away)
- Mesma logica para `isWorst`

Tambem precisa adicionar `tradeball` na lista `KNOWN_SO_BOOKMAKERS` em `src/lib/oddsTypeUtils.ts`, pois hoje tradeball pode entrar no grupo PA por engano (nao esta na lista de SO conhecidos), distorcendo o calculo de `bestPA`.

---

## Problema 2: Bot Telegram so pega jogos do Brasileirao

### Causa raiz

O metodo `fetch_odds()` no bot (linha 258-264) faz uma query simples sem paginacao:

```python
response = self.supabase.client.table('odds_comparison').select('*').execute()
```

O Supabase/PostgREST retorna no maximo **1000 linhas por default**. Com ~220 partidas x ~10 casas cada = **2200+ linhas**, apenas as primeiras 1000 sao retornadas. Como a view ordena por `match_date`, as partidas mais proximas (que tendem a ser de uma ou duas ligas) preenchem o limite, excluindo outras ligas.

O JSON generator ja usa paginacao (`_fetch_all_paginated`) e por isso o frontend mostra todas as ligas normalmente. O bot nao.

### Correcao

Implementar paginacao no `fetch_odds()` do bot, identica ao padrao ja usado pelo JSON generator:

```python
async def fetch_odds(self) -> list:
    try:
        all_data = []
        offset = 0
        page_size = 1000
        
        while True:
            response = (
                self.supabase.client.table('odds_comparison')
                .select('*')
                .order('match_date', desc=False)
                .range(offset, offset + page_size - 1)
                .execute()
            )
            batch = response.data or []
            all_data.extend(batch)
            
            if len(batch) < page_size:
                break
            offset += page_size
        
        return all_data
    except Exception as e:
        self.logger.error(f"Erro ao buscar odds: {e}")
        return []
```

**Arquivo afetado:**
- `docs/scraper/standalone/run_telegram.py` - Metodo `fetch_odds()`, linhas 257-264

---

## Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| `src/pages/MatchDetails.tsx` (OddCell) | Trocar `===` por comparacao arredondada para best/worst highlighting |
| `src/lib/oddsTypeUtils.ts` | Adicionar `tradeball` a `KNOWN_SO_BOOKMAKERS` |
| `docs/scraper/standalone/run_telegram.py` | Paginacao no `fetch_odds()` para buscar TODAS as odds |

## Deploy

```text
Frontend:
- Automatico via Lovable (publicar apos aprovacao)

Backend (VPS):
1. git pull
2. pm2 restart telegram-dg-bot
3. pm2 logs telegram-dg-bot --lines 20
4. Verificar que agora aparece "Buscando DGs: 2200+ odds" (em vez de ~1000)
5. Verificar que DGs de ligas europeias tambem sao detectados
```

