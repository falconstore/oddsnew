
# Plano: Corrigir Mapeamento Incorreto de Ligas (Paulistão → Libertadores)

## Diagnóstico do Problema

O problema identificado é que **jogos do Campeonato Paulista estão sendo salvos como "Libertadores"** no banco de dados.

### Evidências nos Logs

Os dados que você mostrou confirmam:
- "Portuguesa de Desportos SP vs Ponte Preta" → **Libertadores** (deveria ser Paulistão)
- "Guarani-SP vs Botafogo-SP" → **Libertadores** (deveria ser Paulistão)  
- "Corinthians vs Palmeiras" → **Libertadores** (deveria ser Paulistão - clássico!)
- "Capivariano SP vs Mirassol" → **Libertadores** (deveria ser Paulistão)

### Causa Raiz

O `LeagueMatcher` usa **fuzzy matching com threshold de 80%** para encontrar ligas:

```python
result = process.extractOne(
    raw_name,            # "Paulistao" 
    all_names,           # Ligas cadastradas no banco
    scorer=fuzz.token_sort_ratio,
    score_cutoff=80      # Threshold baixo!
)
```

Quando o scraper envia `league_raw = "Paulistao"` e essa liga **não está cadastrada** no banco, o fuzzy matching encontra a liga mais similar. O problema é que "Paulistao" pode casar erroneamente com outras ligas brasileiras.

**Teste de similaridade:**
- "Paulistao" vs "Libertadores" → score pode ser alto o suficiente (>80%) por terem letras em comum

---

## Soluções Propostas

### Parte 1: Cadastrar Liga "Paulistão" no Banco (CRÍTICO)

Executar no SQL Editor do Supabase:

```sql
-- Verificar se Paulistão já existe
SELECT * FROM leagues WHERE name ILIKE '%paulist%';

-- Se não existir, cadastrar
INSERT INTO leagues (name, country, status)
VALUES ('Paulistao', 'Brasil', 'active')
ON CONFLICT DO NOTHING;

-- Também cadastrar variações comuns
INSERT INTO leagues (name, country, status)
VALUES ('Paulistao A1', 'Brasil', 'active')
ON CONFLICT DO NOTHING;
```

### Parte 2: Aumentar Threshold do LeagueMatcher

Modificar o `score_cutoff` de 80 para 90+ para evitar falsos positivos:

**Arquivo**: `docs/scraper/team_matcher.py` (classe LeagueMatcher)

```python
def find_league_id(self, raw_name: str) -> Optional[str]:
    """Find league ID by name using fuzzy matching."""
    normalized = raw_name.strip().lower()
    
    # Exact match
    if normalized in self.reverse_cache:
        return self.reverse_cache[normalized]
    
    # Fuzzy match com threshold MAIS ALTO para evitar falsos positivos
    all_names = list(self.leagues_cache.values())
    result = process.extractOne(
        raw_name,
        all_names,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=92  # Aumentado de 80 para 92
    )
    
    if result:
        return next(
            (lid for lid, name in self.leagues_cache.items() 
             if name == result[0]),
            None
        )
    
    return None
```

### Parte 3: Adicionar Aliases de Ligas (Opcional)

Criar uma tabela de aliases de ligas similar a `team_aliases`:

```sql
-- Criar tabela de aliases de ligas
CREATE TABLE IF NOT EXISTS public.league_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    alias_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(alias_name)
);

-- Cadastrar aliases comuns
INSERT INTO league_aliases (league_id, alias_name) 
SELECT id, 'Campeonato Paulista' FROM leagues WHERE name = 'Paulistao'
UNION ALL
SELECT id, 'Paulista A1' FROM leagues WHERE name = 'Paulistao'
UNION ALL
SELECT id, 'Paulistão Série A1' FROM leagues WHERE name = 'Paulistao';
```

### Parte 4: Corrigir Partidas Existentes

Mover as partidas do Paulistão que estão erroneamente na Libertadores:

```sql
-- 1. Verificar liga correta do Paulistão
SELECT id, name FROM leagues WHERE name ILIKE '%paulist%';
-- Assumindo que retorna: id = 'XXXX-XXXX-XXXX'

-- 2. Verificar liga da Libertadores
SELECT id, name FROM leagues WHERE name ILIKE '%libertadores%';
-- Assumindo que retorna: id = 'YYYY-YYYY-YYYY'

-- 3. Identificar partidas de times paulistas na Libertadores
SELECT m.id, ht.standard_name as home, at.standard_name as away, l.name as league
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id
JOIN teams at ON m.away_team_id = at.id
JOIN leagues l ON m.league_id = l.id
WHERE l.name ILIKE '%libertadores%'
  AND (
    ht.standard_name ILIKE '%SP%' 
    OR ht.standard_name ILIKE '%Corinthians%'
    OR ht.standard_name ILIKE '%Palmeiras%'
    OR ht.standard_name ILIKE '%Santos%'
    OR ht.standard_name ILIKE '%Guarani%'
    OR ht.standard_name ILIKE '%Ponte Preta%'
    OR ht.standard_name ILIKE '%Portuguesa%'
  );

-- 4. Corrigir as partidas (AJUSTAR IDs conforme resultado acima)
-- UPDATE matches SET league_id = 'PAULISTAO_ID' WHERE id IN (...);
```

---

## Resumo das Alterações

| Componente | Alteração | Prioridade |
|------------|-----------|------------|
| Banco de Dados | Cadastrar liga "Paulistão" | **CRÍTICA** |
| team_matcher.py | Aumentar threshold de 80 → 92 | Alta |
| Banco de Dados | Corrigir partidas existentes | Alta |
| Banco de Dados | Criar tabela league_aliases | Média |

---

## Fluxo Corrigido

```text
Scraper envia: league_raw = "Paulistao"
              ↓
LeagueMatcher.find_league_id("Paulistao")
              ↓
Busca exata: "paulistao" no reverse_cache → ✅ ENCONTRADO
              ↓
Retorna league_id do Paulistão
              ↓
Partida é salva com liga correta
              ↓
✅ Monitor mostra na categoria certa
```

---

## SQL de Diagnóstico Imediato

Execute este SQL no Supabase para verificar o estado atual:

```sql
-- 1. Listar todas as ligas cadastradas
SELECT id, name, country, status FROM leagues ORDER BY name;

-- 2. Verificar se Paulistão existe
SELECT * FROM leagues WHERE name ILIKE '%paulist%';

-- 3. Contar partidas por liga
SELECT l.name, COUNT(m.id) as matches
FROM leagues l
LEFT JOIN matches m ON l.id = m.league_id
WHERE m.match_date > NOW()
GROUP BY l.name
ORDER BY matches DESC;

-- 4. Identificar partidas suspeitas na Libertadores
SELECT m.id, ht.standard_name as home, at.standard_name as away, m.match_date
FROM matches m
JOIN teams ht ON m.home_team_id = ht.id  
JOIN teams at ON m.away_team_id = at.id
JOIN leagues l ON m.league_id = l.id
WHERE l.name ILIKE '%libertadores%'
  AND m.match_date > NOW()
ORDER BY m.match_date;
```

---

## Próximos Passos

1. **Executar diagnóstico SQL** para confirmar que Paulistão não está cadastrado
2. **Cadastrar a liga Paulistão** no banco
3. **Aumentar threshold** do LeagueMatcher para evitar futuros erros
4. **Mover partidas** existentes para a liga correta
5. **Reiniciar scrapers** para aplicar as correções
