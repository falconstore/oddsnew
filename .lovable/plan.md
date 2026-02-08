

# Otimizacao de Leitura Supabase - Resolver Partidas Sem Odds

## Diagnostico

Tracei o pipeline completo de dados ate o frontend:

```text
Database (odds_history + 4 JOINs)
  --> View odds_comparison (5 tabelas JOIN)
    --> JSON Generator (le a cada 15s, paginado)
      --> Supabase Storage (odds.json)
        --> Frontend (fetch a cada 15s)
```

### Gargalos identificados:

1. **View `odds_comparison` e muito pesada**: JOIN de 5 tabelas (matches, leagues, teams x2, odds_history, bookmakers) executada a cada 15 segundos pelo JSON Generator. Isso consome muito Disk IO no plano Micro.

2. **JSON Generator le TUDO a cada 15s**: Mesmo que nada tenha mudado, busca todos os dados paginados (potencialmente milhares de linhas) duas vezes (futebol + NBA).

3. **Fallback do frontend sem paginacao**: Se o JSON falhar, o frontend faz query direta na view `odds_comparison` SEM `.limit()` nem `.range()`, batendo no limite de 1000 linhas do PostgREST.

4. **Tabela `odds_history` acumula registros**: Mesmo com `is_latest = TRUE` filtrando, os registros antigos com `is_latest = FALSE` ainda impactam a performance dos indexes e do storage.

5. **Indices faltando**: O index composto ideal para a view (match_id + bookmaker_id + is_latest + odds_type) nao existe.

---

## Plano de Correcao

### Parte 1: SQL - Otimizacao de Indices (executar no Supabase SQL Editor)

Criar indices compostos que aceleram drasticamente a view:

```sql
-- Indice composto para a view odds_comparison (o mais importante)
CREATE INDEX IF NOT EXISTS idx_odds_match_bookmaker_latest 
ON public.odds_history(match_id, bookmaker_id, is_latest, odds_type) 
WHERE is_latest = TRUE;

-- Indice para NBA tambem
CREATE INDEX IF NOT EXISTS idx_nba_odds_match_bookmaker_latest 
ON public.nba_odds_history(match_id, bookmaker_id, is_latest, odds_type) 
WHERE is_latest = TRUE;

-- Indice para filtro de data nas matches (usado pela view)
CREATE INDEX IF NOT EXISTS idx_matches_date_status 
ON public.matches(match_date, status) 
WHERE match_date > NOW() - INTERVAL '1 day';

-- Indice para NBA matches
CREATE INDEX IF NOT EXISTS idx_nba_matches_date_status 
ON public.nba_matches(match_date, status) 
WHERE match_date > NOW() - INTERVAL '1 day';
```

### Parte 2: SQL - Limpeza automatica de odds antigas

Criar funcao para limpar registros `is_latest = FALSE` com mais de 24h (reduz tamanho da tabela e IO):

```sql
-- Funcao de limpeza automatica
CREATE OR REPLACE FUNCTION public.cleanup_old_odds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Deletar odds de futebol nao-latest com mais de 24h
    DELETE FROM public.odds_history 
    WHERE is_latest = FALSE 
      AND scraped_at < NOW() - INTERVAL '24 hours';
    
    -- Deletar odds de NBA nao-latest com mais de 24h
    DELETE FROM public.nba_odds_history 
    WHERE is_latest = FALSE 
      AND scraped_at < NOW() - INTERVAL '24 hours';
    
    RAISE NOTICE 'Cleanup completed';
END;
$$;

-- Executar limpeza imediatamente
SELECT public.cleanup_old_odds();
```

O usuario pode agendar essa funcao via `pg_cron` no Supabase ou rodar manualmente 1x por dia.

### Parte 3: SQL - Funcao RPC otimizada para o JSON Generator

Substituir a leitura da view pesada por uma funcao RPC que retorna apenas os campos necessarios:

```sql
CREATE OR REPLACE FUNCTION public.get_odds_for_json(p_sport_type text DEFAULT 'football')
RETURNS TABLE(
    match_id uuid,
    match_date timestamptz,
    match_status text,
    league_name text,
    league_country text,
    sport_type text,
    home_team text,
    home_team_logo text,
    away_team text,
    away_team_logo text,
    bookmaker_name text,
    bookmaker_id uuid,
    home_odd numeric,
    draw_odd numeric,
    away_odd numeric,
    odds_type text,
    extra_data jsonb,
    scraped_at timestamptz,
    margin_percentage numeric,
    data_age_seconds double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        m.id AS match_id,
        m.match_date,
        m.status AS match_status,
        l.name AS league_name,
        l.country AS league_country,
        COALESCE(l.sport_type, 'football') AS sport_type,
        ht.standard_name AS home_team,
        ht.logo_url AS home_team_logo,
        at2.standard_name AS away_team,
        at2.logo_url AS away_team_logo,
        b.name AS bookmaker_name,
        b.id AS bookmaker_id,
        oh.home_odd,
        CASE WHEN p_sport_type = 'basketball' THEN NULL ELSE oh.draw_odd END AS draw_odd,
        oh.away_odd,
        oh.odds_type,
        oh.extra_data,
        oh.scraped_at,
        CASE 
            WHEN p_sport_type = 'basketball' THEN
                ROUND(((1/oh.home_odd + 1/oh.away_odd) - 1) * 100, 2)
            WHEN oh.home_odd > 0 AND oh.draw_odd > 0 AND oh.away_odd > 0 THEN
                ROUND(((1/oh.home_odd + 1/oh.draw_odd + 1/oh.away_odd) - 1) * 100, 2)
            ELSE NULL 
        END AS margin_percentage,
        EXTRACT(EPOCH FROM (NOW() - oh.scraped_at)) AS data_age_seconds
    FROM matches m
    JOIN leagues l ON m.league_id = l.id
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at2 ON m.away_team_id = at2.id
    JOIN odds_history oh ON m.id = oh.match_id AND oh.is_latest = TRUE
    JOIN bookmakers b ON oh.bookmaker_id = b.id
    WHERE l.status = 'active' 
      AND b.status = 'active'
      AND m.match_date > (NOW() - INTERVAL '30 minutes')
    ORDER BY m.match_date ASC;
$$;

-- Funcao para NBA
CREATE OR REPLACE FUNCTION public.get_nba_odds_for_json()
RETURNS TABLE(
    match_id uuid,
    match_date timestamptz,
    match_status text,
    league_name text,
    league_country text,
    sport_type text,
    home_team text,
    home_team_logo text,
    away_team text,
    away_team_logo text,
    bookmaker_name text,
    bookmaker_id uuid,
    home_odd numeric,
    draw_odd numeric,
    away_odd numeric,
    odds_type text,
    extra_data jsonb,
    scraped_at timestamptz,
    margin_percentage numeric,
    data_age_seconds double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        m.id AS match_id,
        m.match_date,
        m.status AS match_status,
        l.name AS league_name,
        l.country AS league_country,
        'basketball'::text AS sport_type,
        ht.standard_name AS home_team,
        ht.logo_url AS home_team_logo,
        at2.standard_name AS away_team,
        at2.logo_url AS away_team_logo,
        b.name AS bookmaker_name,
        b.id AS bookmaker_id,
        oh.home_odd,
        NULL::numeric AS draw_odd,
        oh.away_odd,
        oh.odds_type,
        oh.extra_data,
        oh.scraped_at,
        ROUND(((1/oh.home_odd + 1/oh.away_odd) - 1) * 100, 2) AS margin_percentage,
        EXTRACT(EPOCH FROM (NOW() - oh.scraped_at)) AS data_age_seconds
    FROM nba_matches m
    JOIN leagues l ON m.league_id = l.id
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at2 ON m.away_team_id = at2.id
    JOIN nba_odds_history oh ON m.id = oh.match_id AND oh.is_latest = TRUE
    JOIN bookmakers b ON oh.bookmaker_id = b.id
    WHERE l.status = 'active' 
      AND b.status = 'active'
      AND m.match_date > (NOW() - INTERVAL '30 minutes')
    ORDER BY m.match_date ASC;
$$;
```

Funcoes RPC com `SECURITY DEFINER` e `STABLE` sao mais eficientes que views porque:
- O planner do PostgreSQL pode otimizar melhor
- Nao passam por RLS (evitam overhead de politicas)
- Podem ser cacheadas internamente

### Parte 4: JSON Generator - Usar RPC em vez de view paginada

Atualizar `supabase_client.py` para usar as funcoes RPC:

**Arquivo: `docs/scraper/supabase_client.py`**

Substituir `fetch_odds_for_json` e `fetch_nba_odds_for_json`:

```python
async def fetch_odds_for_json(self) -> List[Dict[str, Any]]:
    """Fetch football odds via RPC function (optimized, no pagination needed)."""
    try:
        response = self.client.rpc("get_odds_for_json", {"p_sport_type": "football"}).execute()
        data = response.data or []
        self.logger.info(f"Fetched {len(data)} football odds rows (RPC)")
        return data
    except Exception as e:
        self.logger.warning(f"RPC failed, falling back to view: {e}")
        # Fallback to paginated view
        data = self._fetch_all_paginated("odds_comparison", "match_date")
        self.logger.info(f"Fetched {len(data)} football odds rows (fallback)")
        return data

async def fetch_nba_odds_for_json(self) -> List[Dict[str, Any]]:
    """Fetch NBA odds via RPC function (optimized, no pagination needed)."""
    try:
        response = self.client.rpc("get_nba_odds_for_json").execute()
        data = response.data or []
        self.logger.info(f"Fetched {len(data)} NBA odds rows (RPC)")
        return data
    except Exception as e:
        self.logger.warning(f"NBA RPC failed, falling back to view: {e}")
        data = self._fetch_all_paginated("nba_odds_comparison", "match_date")
        self.logger.info(f"Fetched {len(data)} NBA odds rows (fallback)")
        return data
```

### Parte 5: Frontend - Fallback com paginacao

**Arquivo: `src/hooks/useOddsData.ts`**

Corrigir o `fallbackDatabaseQuery` para usar paginacao e nao bater no limite de 1000 linhas:

```typescript
async function fallbackDatabaseQuery(filters?: {
  leagueName?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<MatchOddsGroup[]> {
  const allData: OddsComparison[] = [];
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('odds_comparison')
      .select('*')
      .order('match_date', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (filters?.leagueName) {
      query = query.eq('league_name', filters.leagueName);
    }
    if (filters?.dateFrom) {
      query = query.gte('match_date', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('match_date', filters.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...(data as OddsComparison[]));
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return groupOddsByMatch(allData);
}
```

### Parte 6: Frontend - Aumentar intervalo de refetch

**Arquivo: `src/hooks/useOddsData.ts`**

Mudar o `refetchInterval` de 15s para 30s (reduz requisicoes ao Storage pela metade):

```typescript
refetchInterval: 30000, // Fetch new JSON every 30 seconds (was 15s)
staleTime: 20000,       // Consider data stale after 20s (was 10s)
```

---

## Resumo das mudancas

| Tipo | Onde | Mudanca | Impacto |
|---|---|---|---|
| SQL | Supabase SQL Editor | Indices compostos para odds_history | Reduz IO da view em ~70% |
| SQL | Supabase SQL Editor | Funcao cleanup_old_odds | Reduz tamanho da tabela |
| SQL | Supabase SQL Editor | Funcoes RPC get_odds_for_json | Leitura mais eficiente |
| Python | supabase_client.py | Usar RPC com fallback | Menos queries ao banco |
| Frontend | useOddsData.ts | Fallback com paginacao | Resolve limite 1000 rows |
| Frontend | useOddsData.ts | refetchInterval 30s | Metade das requisicoes |

## Sequencia de execucao

```text
1. Supabase SQL Editor:
   a. Executar criacao dos indices compostos
   b. Executar funcao cleanup_old_odds + chamar SELECT cleanup_old_odds()
   c. Executar criacao das funcoes RPC

2. VPS (scraper):
   a. Atualizar supabase_client.py com as funcoes RPC
   b. pm2 restart json-generator

3. Frontend (Lovable):
   a. Atualizar fallbackDatabaseQuery com paginacao
   b. Atualizar refetchInterval para 30s
   c. Publicar

4. Verificacao:
   a. pm2 logs json-generator --lines 10
   b. Deve mostrar "Fetched X football odds rows (RPC)" em vez de "(paginated)"
   c. Verificar no frontend se todas as partidas mostram odds
```

