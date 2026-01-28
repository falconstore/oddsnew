
# Plano: Corrigir Scraper Novibet - Ignorar Markets sem Tag SO/PA

## Problema Identificado

O jogo **Lyon x PAOK** no JSON da Novibet tem:
- **1 único market** SOCCER_MATCH_RESULT (marketId: 1554525385)
- **Tag**: `SOCCER_2_GOALS_AHEAD_EARLY_PAYOUT` = PA
- **Odds corretas**: 2.08 / 3.50 / 3.50

Mas no frontend aparece:
- Novibet PA: 2.08 / 3.45 / 3.55 (proximo ao correto)
- Novibet SO: 1.77 / 4.15 / 4.55 (ERRADO - nao deveria existir)

## Causa Raiz

No scraper atual (linha 268-269):

```python
else:
    odds_type = "PA"  # Default  ← PROBLEMA
```

Quando um market SOCCER_MATCH_RESULT nao tem tag SO nem PA explicita, ele e classificado como PA por default. Isso pode estar capturando markets incorretos ou causando duplicatas.

## Solucao

Mudar a logica para **ignorar** markets sem tag conhecida em vez de classifica-los como PA.

---

## Arquivo a Modificar

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `docs/scraper/scrapers/novibet_scraper.py` | 263-269 | Ignorar markets sem tag SO/PA |
| `docs/scraper/scrapers/novibet_scraper.py` | 311 | Adicionar path e sport_type no extra_data |

---

## Mudancas no Codigo

### 1. Funcao `_parse_football_response` (linhas 263-269)

**Antes:**
```python
# Identify odds type by tag
if tag == self.TAG_SUPER_ODDS:
    odds_type = "SO"
elif tag == self.TAG_EARLY_PAYOUT_FOOTBALL:
    odds_type = "PA"
else:
    odds_type = "PA"  # Default
```

**Depois:**
```python
# Identify odds type by tag - APENAS aceitar SO ou PA explicitos
if tag == self.TAG_SUPER_ODDS:
    odds_type = "SO"
elif tag == self.TAG_EARLY_PAYOUT_FOOTBALL:
    odds_type = "PA"
else:
    # Ignorar markets sem tag conhecida
    if tag:
        self.logger.debug(f"[Novibet] Tag desconhecida ignorada: {tag}")
    continue  # NAO classificar como PA por default
```

### 2. Extra Data com path (linha 311)

**Antes:**
```python
extra_data={"event_id": str(item.get("eventBetContextId"))}
```

**Depois:**
```python
extra_data={
    "event_id": str(item.get("eventBetContextId")),
    "path": item.get("path", ""),
    "sport_type": "football"
}
```

### 3. Aplicar mesma logica para Basquete

A funcao `_parse_basketball_response` tambem precisa da mesma correcao nas linhas 360-366.

---

## Resultado Esperado

| Jogo | Antes | Depois |
|------|-------|--------|
| Ajax x Olympiacos | PA + SO (ambos corretos) | PA + SO (mantido) |
| Lyon x PAOK | PA + SO (SO errado) | Apenas PA (correto) |
| Qualquer jogo sem SO | PA + SO fabricado | Apenas PA |

---

## Resumo das Alteracoes

1. **Linha 268-269**: Mudar `else: odds_type = "PA"` para `else: continue`
2. **Linha 311**: Adicionar `path` e `sport_type` no extra_data
3. **Linhas 363-369**: Mesma correcao para basquete

Esta mudanca garante que apenas odds com tags explicitas (ODDS_KEY_0 para SO, SOCCER_2_GOALS_AHEAD_EARLY_PAYOUT para PA) sejam capturadas, evitando dados incorretos no frontend.
