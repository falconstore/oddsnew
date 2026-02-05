
# Plano: Serviço de Auto-Geração de Aliases para Times Pendentes

## Resumo

Criar um novo serviço PM2 (`alias-generator`) que:
1. Detecta times não matcheados periodicamente
2. Encontra o melhor match via fuzzy matching
3. Gera SQL pronto para criar aliases
4. Opcionalmente, cria aliases automaticamente acima de um threshold

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────────┐
│                    alias-generator (PM2)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Busca odds recentes sem team_id (odds com NULL)             │
│                                                                 │
│  2. Para cada time não encontrado:                              │
│     └─ Fuzzy match contra todos os teams existentes             │
│     └─ Se score >= 95%: cria alias automaticamente              │
│     └─ Se score >= 80%: gera SQL para revisão manual            │
│                                                                 │
│  3. Salva relatório em logs/pending_aliases.sql                 │
│                                                                 │
│  4. Opcional: publica no Telegram para admin                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Novo Arquivo: `docs/scraper/standalone/run_alias_generator.py`

```python
#!/usr/bin/env python3
"""
Alias Generator Service - Detecta times pendentes e gera SQL para aliases.

Serviço de manutenção que:
1. Busca times não matcheados nos logs recentes
2. Faz fuzzy matching contra times existentes
3. Gera SQL para criar aliases manualmente
4. Auto-cria aliases acima de 95% de confiança

Uso:
    python run_alias_generator.py --interval 300
    python run_alias_generator.py --interval 300 --auto-create
    python run_alias_generator.py --interval 300 --debug
"""

import asyncio
import argparse
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from loguru import logger
from rapidfuzz import fuzz, process

from config import settings
from supabase_client import SupabaseClient
from team_matcher import TeamMatcher


# Thresholds
AUTO_CREATE_THRESHOLD = 95   # Auto-criar alias se score >= 95%
SUGGEST_THRESHOLD = 80       # Sugerir SQL se score >= 80%


class AliasGenerator:
    """Detecta times pendentes e gera aliases."""
    
    def __init__(self, supabase: SupabaseClient):
        self.supabase = supabase
        self.team_matcher = TeamMatcher(supabase)
        self.logger = logger.bind(component="alias-gen")
        self.pending_aliases: Dict[str, List[Dict]] = defaultdict(list)
    
    async def initialize(self):
        """Carrega caches de times e aliases."""
        await self.team_matcher.load_cache()
        self.logger.info(
            f"Loaded {len(self.team_matcher.teams_cache)} teams, "
            f"{len(self.team_matcher.aliases_cache)} aliases"
        )
    
    async def find_unmatched_teams(self) -> List[Dict]:
        """
        Busca times que aparecem em odds mas não têm match.
        Retorna lista de dicts com informações do time pendente.
        """
        # Buscar odds recentes onde o time pode não estar matcheado
        # Isso é feito comparando nomes vindos dos scrapers vs aliases existentes
        
        unmatched = []
        bookmakers = await self.supabase.fetch_bookmakers()
        
        for bookmaker in bookmakers:
            bookmaker_name = bookmaker["name"].lower()
            
            # Buscar aliases existentes para este bookmaker
            existing_aliases = {
                key[0] for key, val in self.team_matcher.aliases_cache.items()
                if key[1] == bookmaker_name
            }
            
            # TODO: Implementar busca em tabela de logs de unmatched
            # Por enquanto, usamos o set _unmatched_logged do team_matcher
            # que é preenchido durante os ciclos de scraping
        
        return unmatched
    
    def find_best_match(
        self, 
        raw_name: str, 
        league_id: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[str], float]:
        """
        Encontra o melhor match para um nome de time.
        
        Returns:
            Tuple (team_id, standard_name, score)
        """
        normalized = self._normalize_name(raw_name)
        
        # Primeiro: buscar na liga específica se fornecida
        if league_id and league_id in self.team_matcher.teams_by_league:
            league_teams = self.team_matcher.teams_by_league[league_id]
            all_names = list(league_teams.keys())
            
            result = process.extractOne(
                normalized.lower(),
                all_names,
                scorer=fuzz.token_sort_ratio,
                score_cutoff=SUGGEST_THRESHOLD
            )
            
            if result:
                team_id = league_teams.get(result[0])
                standard_name = self.team_matcher.teams_cache.get(team_id, result[0])
                return (team_id, standard_name, result[1])
        
        # Segundo: busca global
        all_names = list(self.team_matcher.teams_cache.values())
        
        result = process.extractOne(
            normalized,
            all_names,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=SUGGEST_THRESHOLD
        )
        
        if result:
            team_id = self.team_matcher.reverse_cache.get(result[0].lower())
            return (team_id, result[0], result[1])
        
        return (None, None, 0.0)
    
    def _normalize_name(self, name: str) -> str:
        """Normaliza nome para comparação."""
        import unicodedata
        name = " ".join(name.split())
        name = unicodedata.normalize('NFD', name)
        name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
        return name.strip()
    
    def generate_sql(self, pending: List[Dict]) -> str:
        """Gera SQL para criar aliases."""
        if not pending:
            return "-- Nenhum alias pendente\n"
        
        lines = [
            "-- =====================================================",
            f"-- Aliases Pendentes - Gerado em {datetime.now().isoformat()}",
            f"-- Total: {len(pending)} aliases",
            "-- =====================================================",
            "",
        ]
        
        for item in pending:
            lines.extend([
                f"-- {item['raw_name']} ({item['bookmaker']}) -> {item['standard_name']} [{item['score']:.0f}%]",
                f"INSERT INTO team_aliases (team_id, alias_name, bookmaker_source)",
                f"VALUES ('{item['team_id']}', '{item['raw_name']}', '{item['bookmaker'].lower()}');",
                "",
            ])
        
        return "\n".join(lines)
    
    async def process_pending(
        self, 
        auto_create: bool = False
    ) -> Tuple[int, int, str]:
        """
        Processa times pendentes.
        
        Returns:
            Tuple (auto_created, pending_manual, sql_output)
        """
        auto_created = 0
        pending_manual = []
        
        # Coletar times unmatched do team_matcher
        unmatched_names = list(self.team_matcher._unmatched_logged)
        
        for raw_name in unmatched_names:
            team_id, standard_name, score = self.find_best_match(raw_name)
            
            if not team_id:
                continue
            
            # Determinar bookmaker (TODO: melhorar detecção)
            # Por enquanto, assumir superbet como padrão
            bookmaker = "superbet"
            
            if score >= AUTO_CREATE_THRESHOLD and auto_create:
                # Auto-criar alias
                try:
                    await self.supabase.create_team_alias(
                        team_id=team_id,
                        alias_name=raw_name,
                        bookmaker_source=bookmaker
                    )
                    auto_created += 1
                    self.logger.info(
                        f"[Auto-create] '{raw_name}' -> '{standard_name}' ({score:.0f}%)"
                    )
                except Exception as e:
                    if "duplicate" not in str(e).lower():
                        self.logger.error(f"Failed to create alias: {e}")
            else:
                pending_manual.append({
                    "raw_name": raw_name,
                    "team_id": team_id,
                    "standard_name": standard_name,
                    "score": score,
                    "bookmaker": bookmaker,
                })
        
        sql_output = self.generate_sql(pending_manual)
        
        return auto_created, len(pending_manual), sql_output


async def run_forever(interval: int, auto_create: bool, log: logger):
    """Loop infinito para geração de aliases."""
    supabase = SupabaseClient()
    generator = AliasGenerator(supabase)
    
    await generator.initialize()
    
    cycle_count = 0
    output_path = Path("logs/pending_aliases.sql")
    
    log.info(f"Starting alias generator with interval: {interval}s")
    log.info(f"Auto-create enabled: {auto_create}")
    log.info(f"SQL output: {output_path}")
    
    while True:
        cycle_count += 1
        start_time = datetime.now(timezone.utc)
        
        try:
            # Recarregar caches para pegar novos times
            await generator.initialize()
            
            # Processar pendentes
            auto_created, pending, sql = await generator.process_pending(auto_create)
            
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            
            if auto_created > 0 or pending > 0:
                log.info(
                    f"[Cycle {cycle_count}] "
                    f"Auto-created: {auto_created}, Pending: {pending}, "
                    f"Duration: {duration:.1f}s"
                )
                
                # Salvar SQL
                with open(output_path, "w") as f:
                    f.write(sql)
                log.info(f"SQL saved to {output_path}")
            else:
                log.debug(f"[Cycle {cycle_count}] No pending aliases")
                
        except Exception as e:
            log.error(f"[Cycle {cycle_count}] Error: {e}")
        
        try:
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            log.info("Shutdown requested")
            break


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Alias Generator - Gera SQL para times pendentes"
    )
    
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Intervalo entre ciclos em segundos (default: 300 = 5 min)"
    )
    
    parser.add_argument(
        "--auto-create",
        action="store_true",
        help="Auto-criar aliases com score >= 95%%"
    )
    
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Ativar logging de debug"
    )
    
    return parser.parse_args()
```

---

## Atualização: `docs/scraper/ecosystem.config.js`

Adicionar novo serviço:

```javascript
// ============================================
// ALIAS GENERATOR SERVICE
// ============================================

{
  name: 'alias-generator',
  script: 'standalone/run_alias_generator.py',
  interpreter: 'python3',
  args: '--interval 300 --auto-create',
  cwd: __dirname,
  max_memory_restart: '100M',
  restart_delay: 5000,
  max_restarts: 100,
  autorestart: true,
  env: {
    PYTHONUNBUFFERED: '1'
  }
},
```

---

## Melhoria: Tabela de Logs de Unmatched

Para persistir times não matcheados entre ciclos, criar uma tabela:

```sql
-- Migration: Tabela de logs de times não matcheados
CREATE TABLE IF NOT EXISTS unmatched_teams_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_name text NOT NULL,
    bookmaker text NOT NULL,
    league_name text,
    scraped_at timestamptz DEFAULT now(),
    resolved boolean DEFAULT false,
    resolved_at timestamptz,
    resolved_team_id uuid REFERENCES teams(id),
    UNIQUE(raw_name, bookmaker)
);

-- Index para busca
CREATE INDEX idx_unmatched_pending ON unmatched_teams_log(resolved) 
WHERE resolved = false;

-- Auto-cleanup de logs antigos resolvidos
CREATE OR REPLACE FUNCTION cleanup_old_unmatched_logs()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM unmatched_teams_log 
    WHERE resolved = true 
    AND resolved_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Atualização: `docs/scraper/team_matcher.py`

Adicionar método para persistir unmatched:

```python
async def log_unmatched_to_db(
    self, 
    raw_name: str, 
    bookmaker: str, 
    league_name: str = None
):
    """Persiste time não matcheado no banco para análise posterior."""
    try:
        await self.supabase.client.table("unmatched_teams_log").upsert({
            "raw_name": raw_name,
            "bookmaker": bookmaker.lower(),
            "league_name": league_name,
            "resolved": False,
        }, on_conflict="raw_name,bookmaker").execute()
    except Exception as e:
        self.logger.debug(f"Failed to log unmatched: {e}")
```

---

## Fluxo Completo

```text
CICLO DE SCRAPING
┌─────────────────────────────────────────────────────────────────┐
│  Scraper coleta odds                                            │
│      ↓                                                          │
│  TeamMatcher tenta encontrar team_id                            │
│      ↓                                                          │
│  Se não encontrar:                                              │
│      └─ Loga em _unmatched_logged (memória)                     │
│      └─ Persiste em unmatched_teams_log (banco)                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  alias-generator (a cada 5 min)                                 │
│      ↓                                                          │
│  Busca times em unmatched_teams_log WHERE resolved = false      │
│      ↓                                                          │
│  Para cada time:                                                │
│      └─ Fuzzy match contra teams existentes                     │
│      └─ Score >= 95%: cria alias automaticamente                │
│      └─ Score >= 80%: gera SQL em logs/pending_aliases.sql      │
│      ↓                                                          │
│  Marca como resolved no banco                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Output Esperado

### Console (PM2 logs)
```text
2026-02-06 00:05:00 | INFO     | alias-gen | Starting alias generator with interval: 300s
2026-02-06 00:05:00 | INFO     | alias-gen | Auto-create enabled: True
2026-02-06 00:05:01 | INFO     | alias-gen | Loaded 485 teams, 1247 aliases
2026-02-06 00:05:02 | INFO     | alias-gen | [Auto-create] 'Celta de Vigo' -> 'Celta Vigo' (97%)
2026-02-06 00:05:02 | INFO     | alias-gen | [Cycle 1] Auto-created: 3, Pending: 7, Duration: 1.2s
2026-02-06 00:05:02 | INFO     | alias-gen | SQL saved to logs/pending_aliases.sql
```

### Arquivo SQL Gerado
```sql
-- =====================================================
-- Aliases Pendentes - Gerado em 2026-02-06T00:05:02
-- Total: 7 aliases
-- =====================================================

-- RC Celta (bet365) -> Celta Vigo [82%]
INSERT INTO team_aliases (team_id, alias_name, bookmaker_source)
VALUES ('uuid-celta', 'RC Celta', 'bet365');

-- Internazionale (betano) -> Inter Milan [88%]
INSERT INTO team_aliases (team_id, alias_name, bookmaker_source)
VALUES ('uuid-inter', 'Internazionale', 'betano');
```

---

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `standalone/run_alias_generator.py` | NOVO - Serviço principal |
| `ecosystem.config.js` | Adicionar entrada do serviço |
| `team_matcher.py` | Adicionar método `log_unmatched_to_db` |
| Migration SQL | Criar tabela `unmatched_teams_log` |

---

## Comandos PM2

```bash
# Iniciar apenas o alias generator
pm2 start docs/scraper/ecosystem.config.js --only alias-generator

# Ver logs
pm2 logs alias-generator

# Ver SQL gerado
cat docs/scraper/logs/pending_aliases.sql
```
