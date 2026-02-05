
# Plano: Correção do Script de Consolidação de Times Duplicados

## Problema Identificado

O erro ocorre na primeira consolidação (AZ Alkmaar):

```
ERROR: 23505: duplicate key value violates unique constraint "idx_matches_unique_per_day"
Key (league_id, home_team_id, away_team_id, match_day_utc(match_date))=
(c76d9269-0727-4f47-bf9e-64b6bd57e802, ae940ace-9bf5-4016-b3a2-5b0e41f57f6c, b25a1fdf-cdde-48b2-b464-e0dffac6712a, 2026-02-19)
```

**Causa**: Ao fazer UPDATE para mudar o `team_id` duplicado para o canônico, já existe uma partida com essa combinação (liga + home + away + dia).

Por exemplo:
- Partida A: Time X vs AZ Alkmaar (Eredivisie ID) em 19/02
- Partida B: Time X vs AZ Alkmaar (Canônico ID) em 19/02

Ao tentar mudar Partida A para usar o ID canônico, conflita com Partida B.

---

## Solução

Modificar o script `cleanup_duplicates.py` para:

1. **Antes** de fazer UPDATE, deletar partidas que seriam duplicatas
2. Manter a partida com o ID canônico (que tem mais odds vinculadas)
3. Deletar as odds órfãs junto com a partida

---

## Alterações Necessárias

### Arquivo: `docs/scraper/cleanup_duplicates.py`

Atualizar a função `generate_merge_sql` para incluir DELETE de partidas conflitantes:

```python
def generate_merge_sql(duplicates: Dict[str, List[dict]]) -> str:
    """
    Gera SQL para consolidar times duplicados.
    Inclui lógica para remover partidas duplicadas antes do UPDATE.
    """
    if not duplicates:
        return "-- Nenhuma duplicata para consolidar"
    
    sql_lines = [
        "-- =====================================================",
        "-- SQL para consolidar times duplicados",
        "-- REVISE CUIDADOSAMENTE antes de executar!",
        "-- =====================================================",
        "",
        "-- IMPORTANTE: Execute em uma transação!",
        "BEGIN;",
        "",
    ]
    
    for name, entries in sorted(duplicates.items()):
        canonical = entries[0]
        duplicates_to_remove = entries[1:]
        
        sql_lines.append(f"-- ========== Consolidar: {name} ==========")
        sql_lines.append(f"-- Canônico: {canonical['id']} ({canonical['league_name']})")
        sql_lines.append("")
        
        for dup in duplicates_to_remove:
            dup_id = dup['id']
            canonical_id = canonical['id']
            
            sql_lines.extend([
                f"-- Migrar {dup_id} ({dup['league_name']}) -> {canonical_id}",
                "",
                "-- 1. Deletar partidas que causariam conflito (home_team)",
                f"""DELETE FROM matches WHERE id IN (
  SELECT m_dup.id FROM matches m_dup
  JOIN matches m_canonical ON 
    m_dup.league_id = m_canonical.league_id AND
    m_canonical.home_team_id = '{canonical_id}' AND
    m_dup.away_team_id = m_canonical.away_team_id AND
    DATE_TRUNC('day', m_dup.match_date) = DATE_TRUNC('day', m_canonical.match_date)
  WHERE m_dup.home_team_id = '{dup_id}'
);""",
                "",
                "-- 2. Deletar partidas que causariam conflito (away_team)",
                f"""DELETE FROM matches WHERE id IN (
  SELECT m_dup.id FROM matches m_dup
  JOIN matches m_canonical ON 
    m_dup.league_id = m_canonical.league_id AND
    m_dup.home_team_id = m_canonical.home_team_id AND
    m_canonical.away_team_id = '{canonical_id}' AND
    DATE_TRUNC('day', m_dup.match_date) = DATE_TRUNC('day', m_canonical.match_date)
  WHERE m_dup.away_team_id = '{dup_id}'
);""",
                "",
                "-- 3. Agora fazer os UPDATEs sem conflito",
                f"UPDATE team_aliases SET team_id = '{canonical_id}' WHERE team_id = '{dup_id}';",
                f"UPDATE matches SET home_team_id = '{canonical_id}' WHERE home_team_id = '{dup_id}';",
                f"UPDATE matches SET away_team_id = '{canonical_id}' WHERE away_team_id = '{dup_id}';",
                f"UPDATE nba_matches SET home_team_id = '{canonical_id}' WHERE home_team_id = '{dup_id}';",
                f"UPDATE nba_matches SET away_team_id = '{canonical_id}' WHERE away_team_id = '{dup_id}';",
                "",
                "-- 4. Deletar time duplicado",
                f"DELETE FROM teams WHERE id = '{dup_id}';",
                "",
            ])
        
        sql_lines.append("")
    
    sql_lines.extend([
        "-- Se tudo estiver correto, confirme a transação:",
        "COMMIT;",
        "",
        "-- Se algo deu errado, use: ROLLBACK;",
    ])
    
    return "\n".join(sql_lines)
```

---

## SQL Corrigido para Execução Imediata

Execute este SQL no Supabase para resolver os 9 times:

```sql
BEGIN;

-- ========== AZ Alkmaar ==========
-- Deletar partidas duplicadas antes do UPDATE
DELETE FROM matches WHERE id IN (
  SELECT m_dup.id FROM matches m_dup
  JOIN matches m_canonical ON 
    m_dup.league_id = m_canonical.league_id AND
    m_canonical.home_team_id = 'b25a1fdf-cdde-48b2-b464-e0dffac6712a' AND
    m_dup.away_team_id = m_canonical.away_team_id AND
    DATE_TRUNC('day', m_dup.match_date) = DATE_TRUNC('day', m_canonical.match_date)
  WHERE m_dup.home_team_id = '2e89573b-7787-4418-a1b9-147dbf7e4d5c'
);
DELETE FROM matches WHERE id IN (
  SELECT m_dup.id FROM matches m_dup
  JOIN matches m_canonical ON 
    m_dup.league_id = m_canonical.league_id AND
    m_dup.home_team_id = m_canonical.home_team_id AND
    m_canonical.away_team_id = 'b25a1fdf-cdde-48b2-b464-e0dffac6712a' AND
    DATE_TRUNC('day', m_dup.match_date) = DATE_TRUNC('day', m_canonical.match_date)
  WHERE m_dup.away_team_id = '2e89573b-7787-4418-a1b9-147dbf7e4d5c'
);
UPDATE team_aliases SET team_id = 'b25a1fdf-cdde-48b2-b464-e0dffac6712a' WHERE team_id = '2e89573b-7787-4418-a1b9-147dbf7e4d5c';
UPDATE matches SET home_team_id = 'b25a1fdf-cdde-48b2-b464-e0dffac6712a' WHERE home_team_id = '2e89573b-7787-4418-a1b9-147dbf7e4d5c';
UPDATE matches SET away_team_id = 'b25a1fdf-cdde-48b2-b464-e0dffac6712a' WHERE away_team_id = '2e89573b-7787-4418-a1b9-147dbf7e4d5c';
UPDATE nba_matches SET home_team_id = 'b25a1fdf-cdde-48b2-b464-e0dffac6712a' WHERE home_team_id = '2e89573b-7787-4418-a1b9-147dbf7e4d5c';
UPDATE nba_matches SET away_team_id = 'b25a1fdf-cdde-48b2-b464-e0dffac6712a' WHERE away_team_id = '2e89573b-7787-4418-a1b9-147dbf7e4d5c';
DELETE FROM teams WHERE id = '2e89573b-7787-4418-a1b9-147dbf7e4d5c';

-- (Repetir para os outros 8 times)

COMMIT;
```

---

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `cleanup_duplicates.py` | Atualizar `generate_merge_sql` para incluir DELETE de conflitos |
| Arquivo de migration | Novo SQL com lógica de deduplicação |

---

## Notas Importantes

1. **CASCADE**: As odds são deletadas automaticamente via `ON DELETE CASCADE` quando a partida é removida
2. **Transação**: O `BEGIN/COMMIT` garante atomicidade - se algo falhar, faz ROLLBACK automático
3. **Ordem**: DELETE de conflitos vem ANTES dos UPDATEs para evitar violação de unique constraint
