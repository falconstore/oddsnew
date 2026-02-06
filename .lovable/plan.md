

# Plano: Corrigir Queda de Partidas no JSON (166 para 68)

## Problema Confirmado

As partidas **NAO estao sendo deletadas do banco** - elas continuam la. O problema esta na **geracao do JSON** dentro do `orchestrator.py`, que filtra partidas durante o agrupamento.

## Causa Raiz: Conflito de Timezone

O scraper da Superbet converte UTC para horario do Brasil **ANTES** de salvar:

```python
# superbet_scraper.py linha 227-229
match_date_utc = datetime.fromisoformat(utc_date.replace("Z", "+00:00"))
# Convert to Brazil time (UTC-3) - Superbet returns UTC
match_date = match_date_utc - timedelta(hours=3)  # ← PROBLEMA!
```

Resultado: se um jogo e as 15:00 UTC, a Superbet grava como 12:00 (Brasil) mas **SEM timezone info**. 

Depois, no `_group_odds_for_json`, o codigo compara:
```python
now = datetime.now(timezone.utc)  # Ex: 03:30 UTC
five_minutes_ago = now - timedelta(minutes=5)  # 03:25 UTC

# match_date foi gravado como 00:30 (Brasil = 03:30 UTC menos 3h)
# mas sem timezone, entao e interpretado como 00:30 UTC
if match_date < five_minutes_ago:  # 00:30 < 03:25 → TRUE!
    continue  # ← Partida VALIDA sendo descartada!
```

**Isso explica porque 166 vira 68**: partidas que deveriam aparecer sao filtradas porque o horario foi subtraido 3h mas o filtro compara como se fosse UTC.

## Problema Secundario: Composite Key sem Liga

A chave de agrupamento nao inclui a liga:

```python
composite_key = f"{home_team}_{away_team}_{match_date_key}"
```

Se Corinthians joga contra Palmeiras no Paulistao E na Copa do Brasil no mesmo dia, uma partida sobrescreve a outra.

---

## Correcoes Necessarias

### Correcao 1: Superbet deve gravar em UTC (nao subtrair 3h)

**Arquivo**: `docs/scraper/scrapers/superbet_scraper.py`

**Linha 227-231** - Alterar de:

```python
match_date_utc = datetime.fromisoformat(utc_date.replace("Z", "+00:00"))
# Convert to Brazil time (UTC-3) - Superbet returns UTC
match_date = match_date_utc - timedelta(hours=3)
```

Para:

```python
# Manter em UTC - o frontend converte para local
match_date = datetime.fromisoformat(utc_date.replace("Z", "+00:00"))
```

### Correcao 2: Adicionar liga na composite key

**Arquivo**: `docs/scraper/orchestrator.py`

**Linha 675-679** - Alterar de:

```python
home_team = row.get("home_team", "")
away_team = row.get("away_team", "")
match_date_key = match_date.date().isoformat()
composite_key = f"{home_team}_{away_team}_{match_date_key}"
```

Para:

```python
home_team = row.get("home_team", "")
away_team = row.get("away_team", "")
league_name = row.get("league_name", "")
match_date_key = match_date.date().isoformat()
composite_key = f"{league_name}_{home_team}_{away_team}_{match_date_key}"
```

### Correcao 3: Mesmo fix no JSON Generator standalone

**Arquivo**: `docs/scraper/standalone/run_json_generator.py`

**Linha 85-89** - Adicionar league_name na composite key:

```python
home_team = row.get("home_team", "")
away_team = row.get("away_team", "")
league_name = row.get("league_name", "")
match_date_key = match_date.date().isoformat()
composite_key = f"{league_name}_{home_team}_{away_team}_{match_date_key}"
```

---

## Por Que 166 Vira 68

| Ciclo | Superbet grava | Outras casas gravam | Filtro interpreta |
|-------|----------------|---------------------|-------------------|
| 1 | 12:00 (Brasil, sem TZ) | 15:00 UTC | 12:00 < 03:25 UTC → removida |
| 1 | 12:00 (Brasil, sem TZ) | - | Mesmo problema |

A cada ciclo do orchestrator:

1. View retorna 1900 odds (166 partidas)
2. Filtro `match_date < five_minutes_ago` remove ~98 partidas por erro de TZ
3. Resultado: 68 partidas

---

## Checklist de Implementacao

| Prioridade | Arquivo | Alteracao |
|------------|---------|-----------|
| 1 | superbet_scraper.py | Remover subtracao de 3h (manter UTC) |
| 2 | orchestrator.py | Adicionar league_name na composite key |
| 3 | run_json_generator.py | Adicionar league_name na composite key |

---

## Secao Tecnica

### Fluxo do Problema

```text
1. Superbet API retorna: utcDate = "2026-02-06T15:00:00Z" (15h UTC)

2. superbet_scraper.py:
   match_date = 15:00 UTC - 3h = 12:00 (naive datetime, sem TZ)

3. Banco de dados (matches.match_date):
   Grava 12:00 sem timezone (timestamp without time zone)

4. View odds_comparison:
   Retorna 12:00 (interpretado como UTC pelo PostgREST)

5. orchestrator._group_odds_for_json:
   now = 03:30 UTC
   five_minutes_ago = 03:25 UTC
   match_date = 12:00 (interpretado como UTC)
   
   12:00 < 03:25? SIM (errado - 12:00 e FUTURO no Brasil!)
   → Partida descartada

6. odds.json: 68 partidas (deveria ter 166)
```

### Solucao Correta

Todos os scrapers devem gravar datas em **UTC**. O frontend converte para horario local usando `toLocaleString()` do JavaScript.

A Superbet estava tentando "ajudar" convertendo para Brasil, mas isso quebrou o filtro de comparacao.

### Impacto Esperado

Apos as correcoes:

- Todas as 166 partidas aparecerão no JSON
- Partidas de ligas diferentes com mesmos times nao colidirao
- O sistema voltara a funcionar como antes da migracao para Superbet como casa mae

