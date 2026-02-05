
# Plano: Corrigir Erro de Await no Alias Generator

## Problema Identificado

O erro:
```
ERROR | alias-gen | Failed to fetch unmatched teams: object APIResponse can't be used in 'await' expression
```

Ocorre porque o `SupabaseClient` usa o cliente **síncrono** do Supabase (`create_client` de `supabase`), mas no `run_alias_generator.py` estamos tentando usar `await` diretamente nas queries.

### Código Atual (Linha 67-72):
```python
response = await self.supabase.client.table("unmatched_teams_log") \
    .select("*") \
    .eq("resolved", False) \
    .execute()  # ← APIResponse, não é awaitable!
```

## Solução

Remover o `await` das queries diretas ao `self.supabase.client` - elas são síncronas.

---

## Alterações Necessárias

### Arquivo: `docs/scraper/standalone/run_alias_generator.py`

**1. Método `fetch_unmatched_from_db` (linhas 61-77)**

Remover `await` da query:

```python
async def fetch_unmatched_from_db(self) -> List[Dict]:
    """
    Busca times não matcheados da tabela unmatched_teams_log.
    Retorna lista de dicts com informações do time pendente.
    """
    try:
        response = self.supabase.client.table("unmatched_teams_log") \
            .select("*") \
            .eq("resolved", False) \
            .order("scraped_at", desc=True) \
            .limit(100) \
            .execute()
        
        return response.data if response.data else []
    except Exception as e:
        self.logger.error(f"Failed to fetch unmatched teams: {e}")
        return []
```

**2. Método `mark_as_resolved` (linhas 158-176)**

Remover `await` da query:

```python
async def mark_as_resolved(
    self, 
    raw_name: str, 
    bookmaker: str, 
    team_id: str
):
    """Marca um time como resolvido na tabela de logs."""
    try:
        self.supabase.client.table("unmatched_teams_log") \
            .update({
                "resolved": True,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolved_team_id": team_id,
            }) \
            .eq("raw_name", raw_name) \
            .eq("bookmaker", bookmaker.lower()) \
            .execute()
    except Exception as e:
        self.logger.debug(f"Failed to mark as resolved: {e}")
```

---

## Resumo das Alterações

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `run_alias_generator.py` | 67 | Remover `await` de `self.supabase.client.table(...).execute()` |
| `run_alias_generator.py` | 166 | Remover `await` de `self.supabase.client.table(...).execute()` |

---

## Por que isso funciona?

O padrão do projeto usa métodos `async` para compatibilidade com o orquestrador asyncio, mas o cliente Supabase subjacente é síncrono:

```python
# supabase_client.py usa o cliente sync
from supabase import create_client  # ← Cliente síncrono

# Os métodos async existentes funcionam porque:
async def fetch_teams(self):
    response = self.client.table("teams").select("*").execute()  # ← Sem await
    return response.data
```

Os métodos como `fetch_teams`, `create_team_alias`, etc. **não usam `await`** no `execute()` - eles são declarados `async` apenas para serem chamados com `await` de fora.

---

## Validação Pós-Deploy

Após aplicar a correção:

```bash
pm2 restart alias-generator
pm2 logs alias-generator --lines 20
```

Output esperado:
```
23:30:00 | INFO     | alias-gen    | Loaded 294 teams, 823 aliases
23:30:01 | DEBUG    | alias-gen    | [Cycle 1] No pending aliases (0.8s)
```

Ou, se houver times pendentes na tabela:
```
23:30:01 | INFO     | alias-gen    | Processing 5 unmatched teams...
23:30:01 | INFO     | alias-gen    | [Auto-create] 'Celta de Vigo' -> 'Celta Vigo' (97%)
```
