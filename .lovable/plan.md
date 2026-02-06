
# Plano: Implementar Paginação para Carregar Todas as 219 Partidas

## Problema Confirmado

| Fonte | Valor |
|-------|-------|
| Banco de dados | **219 partidas** (2431 linhas de odds) |
| odds.json | ~70 partidas |

O Supabase/PostgREST tem um limite padrao de **1000 linhas por request**. O codigo atual nao faz paginacao, entao recebe apenas um recorte dos dados.

---

## Causa Raiz

**Arquivo**: `docs/scraper/supabase_client.py` (linhas 702-728)

```python
async def fetch_odds_for_json(self) -> List[Dict[str, Any]]:
    response = (
        self.client.table("odds_comparison")
        .select("*")
        .order("match_date", desc=False)
        .execute()  # ← Retorna no maximo ~1000 linhas!
    )
    return response.data or []
```

O mesmo problema existe em `fetch_nba_odds_for_json()`.

---

## Solucao: Implementar Paginacao

### Correcao 1: Metodo helper para paginacao

Adicionar um metodo generico de paginacao no `SupabaseClient`:

```python
def _fetch_all_paginated(self, table_name: str, order_by: str = "match_date", page_size: int = 1000) -> List[Dict[str, Any]]:
    """
    Fetch all rows from a table/view using pagination.
    Supabase/PostgREST limits responses to ~1000 rows by default.
    """
    all_data = []
    offset = 0
    
    while True:
        response = (
            self.client.table(table_name)
            .select("*")
            .order(order_by, desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        
        batch = response.data or []
        all_data.extend(batch)
        
        # Se retornou menos que page_size, acabaram os dados
        if len(batch) < page_size:
            break
            
        offset += page_size
    
    return all_data
```

### Correcao 2: Atualizar fetch_odds_for_json

```python
async def fetch_odds_for_json(self) -> List[Dict[str, Any]]:
    """Fetch all football odds data from the comparison view for JSON export."""
    try:
        data = self._fetch_all_paginated("odds_comparison", "match_date")
        self.logger.info(f"Fetched {len(data)} football odds rows")
        return data
    except Exception as e:
        self.logger.error(f"Error fetching odds for JSON: {e}")
        return []
```

### Correcao 3: Atualizar fetch_nba_odds_for_json

```python
async def fetch_nba_odds_for_json(self) -> List[Dict[str, Any]]:
    """Fetch all NBA odds data from the nba_odds_comparison view for JSON export."""
    try:
        data = self._fetch_all_paginated("nba_odds_comparison", "match_date")
        self.logger.info(f"Fetched {len(data)} NBA odds rows")
        return data
    except Exception as e:
        self.logger.error(f"Error fetching NBA odds for JSON: {e}")
        return []
```

---

## Correcao Adicional: NBA com draw null

O frontend espera `draw_odd: null` para basquete, mas o gerador esta colocando `0`.

**Arquivo**: `docs/scraper/standalone/run_json_generator.py`

Apos agrupar as partidas, garantir que basquete tenha valores null:

```python
# Apos o loop de agrupamento, antes de retornar
for match in match_map.values():
    if match.get("sport_type") == "basketball":
        match["best_draw"] = None
        match["worst_draw"] = None
        for odds in match.get("odds", []):
            odds["draw_odd"] = None
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase_client.py` | Adicionar `_fetch_all_paginated()` |
| `supabase_client.py` | Atualizar `fetch_odds_for_json()` para usar paginacao |
| `supabase_client.py` | Atualizar `fetch_nba_odds_for_json()` para usar paginacao |
| `run_json_generator.py` | Garantir `draw_odd = null` para basquete |

---

## Resultado Esperado

Apos as correcoes:

- **Antes**: ~1000 linhas → ~70 partidas
- **Depois**: ~2431 linhas → ~219 partidas

O sistema voltara a mostrar todas as partidas disponiveis, como funcionava antes.

---

## Secao Tecnica

### Como o PostgREST limita resultados

O Supabase usa PostgREST que tem um limite padrao de linhas por request (geralmente 1000). Para buscar mais, e necessario usar `.range(offset, limit)`:

```python
# Pagina 1: linhas 0-999
.range(0, 999)

# Pagina 2: linhas 1000-1999
.range(1000, 1999)

# E assim por diante...
```

### Por que o problema so apareceu agora?

Antes da Superbet como casa mae:

- Menos casas coletando odds
- Menos linhas totais na view
- Provavelmente ficava abaixo do limite de 1000

Com a Superbet + todas as outras casas:

- Mais partidas sendo criadas
- Mais odds por partida
- Total ultrapassou 1000 linhas → truncamento

### Fluxo corrigido

```text
1. fetch_odds_for_json()
   - Pagina 1: linhas 0-999 (1000 rows)
   - Pagina 2: linhas 1000-1999 (1000 rows)
   - Pagina 3: linhas 2000-2431 (431 rows)
   - Total: 2431 rows ✓

2. group_odds_for_json()
   - Agrupa por league + home + away + date
   - Resultado: 219 partidas ✓

3. odds.json
   - matches_count: 219 ✓
```
