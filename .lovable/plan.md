

# Orquestrador Sequencial com Rollback Fácil

## Resumo

Criar um novo sistema de execução sequencial mantendo o sistema paralelo atual intacto, permitindo trocar entre os dois modos com um único comando PM2.

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `docs/scraper/standalone/run_sequential.py` | Orquestrador sequencial (NOVO) |
| `docs/scraper/ecosystem.sequential.config.js` | Config PM2 modo sequencial (NOVO) |

## Arquivos Mantidos (para rollback)

| Arquivo | Função |
|---------|--------|
| `docs/scraper/ecosystem.config.js` | Config atual (paralelo) - NÃO MODIFICAR |
| `docs/scraper/standalone/run_scraper.py` | Runner atual - NÃO MODIFICAR |

## Como Trocar Entre Modos

```text
# Modo SEQUENCIAL (novo, leve):
pm2 stop all
pm2 delete all  
pm2 start ecosystem.sequential.config.js
pm2 save

# Modo PARALELO (original, voltar):
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

## Estrutura do Orquestrador Sequencial

```text
+-------------------------------------------+
|           run_sequential.py               |
|-------------------------------------------|
| SharedResources (1 instancia)             |
| OddsNormalizer (1 instancia)              |
| SupabaseClient (1 instancia)              |
|-------------------------------------------|
|  Loop infinito:                           |
|    for scraper in ORDEM:                  |
|      1. Importar classe (lazy)            |
|      2. Criar instancia                   |
|      3. scrape_all() com timeout          |
|      4. normalize_and_insert()            |
|      5. Enviar heartbeat                  |
|      6. Proximo scraper (sem sleep)       |
+-------------------------------------------+
```

## Ordem de Execução

O orquestrador vai rodar scrapers em sequência, alternando entre leves e pesados para distribuir carga:

```text
Grupo LIGHT (HTTPX - ~10s cada):
  superbet -> novibet -> kto -> estrelabet -> sportingbet -> 
  betnacional -> br4bet -> mcgames -> jogodeouro -> tradeball -> 
  bet365 -> br4bet_nba -> mcgames_nba -> jogodeouro_nba

Grupo HEAVY (Playwright - ~60s cada):  
  betano -> betbra -> stake -> aposta1 -> esportivabet
```

## Modos de Operação

```text
--mode all    : Todos os scrapers em 1 processo (mais simples)
--mode light  : Apenas HTTPX scrapers (ciclo ~2-3 min)
--mode heavy  : Apenas Playwright scrapers (ciclo ~5 min)
```

## Configuração PM2 Sequencial

A nova config terá apenas 4 processos:

```text
1. scraper-seq-light   : Scrapers HTTPX em loop
2. scraper-seq-heavy   : Scrapers Playwright em loop  
3. json-generator      : Gerar JSON (mantido)
4. cleanup-service     : Limpeza (mantido)
```

## Comparativo de Carga

| Aspecto | Paralelo (atual) | Sequencial (novo) |
|---------|------------------|-------------------|
| Processos PM2 | 18+ | 4 |
| Chrome simultaneos | 2-5 | 1 |
| Load maximo | 11+ | 2-4 (estimado) |
| Memoria total | 2-3 GB | 400-600 MB |
| Freshness | 30-120s | 5-8 min (ciclo completo) |

## Segurança: Timeout por Scraper

Cada scraper terá timeout de 120s para evitar travamento:

```python
try:
    odds = await asyncio.wait_for(
        scraper.scrape_all(), 
        timeout=120.0
    )
except asyncio.TimeoutError:
    log.error(f"{scraper_name} timeout após 120s")
    # Continua pro próximo
```

## Sequência de Implementação

1. Criar `run_sequential.py` com toda a lógica
2. Criar `ecosystem.sequential.config.js` 
3. Copiar ambos arquivos para VPS
4. Validar sintaxe: `python3 -m py_compile standalone/run_sequential.py`
5. Testar manualmente: `python3 standalone/run_sequential.py --mode light`
6. Se funcionar: `pm2 start ecosystem.sequential.config.js`
7. Monitorar `htop` e `pm2 logs`

## Rollback (voltar ao paralelo)

Se o modo sequencial não funcionar bem:

```bash
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.js   # Original
pm2 save
```

Nenhum arquivo original é modificado, então o rollback é instantâneo.

---

## Detalhes Técnicos

### run_sequential.py

```python
#!/usr/bin/env python3
"""
Sequential Scraper Runner - Executa scrapers em sequência.

Uso:
    python run_sequential.py --mode all
    python run_sequential.py --mode light
    python run_sequential.py --mode heavy
"""

LIGHT_SCRAPERS = [
    "superbet", "novibet", "kto", "estrelabet", "sportingbet",
    "betnacional", "br4bet", "mcgames", "jogodeouro", "tradeball",
    "bet365", "br4bet_nba", "mcgames_nba", "jogodeouro_nba"
]

HEAVY_SCRAPERS = [
    "betano", "betbra", "stake", "aposta1", "esportivabet"
]

# Importar get_scraper_class do run_scraper.py existente
# Reutilizar SharedResources e OddsNormalizer

async def run_sequential(scrapers: list, log):
    resources = await get_shared_resources()
    normalizer = OddsNormalizer(resources)
    supabase = SupabaseClient()
    
    cycle = 0
    while True:
        cycle += 1
        log.info(f"=== Cycle {cycle} ===")
        
        for scraper_name in scrapers:
            start = time.time()
            try:
                # Lazy import (mesmo pattern do run_scraper.py)
                scraper_class = get_scraper_class(scraper_name)
                scraper = scraper_class()
                
                # Timeout de 120s por scraper
                odds = await asyncio.wait_for(
                    scraper.scrape_all(),
                    timeout=120.0
                )
                
                odds_inserted = 0
                if odds:
                    football, nba = await normalizer.normalize_and_insert(odds)
                    odds_inserted = football + nba
                
                duration = time.time() - start
                log.info(f"{scraper_name}: {len(odds) if odds else 0} -> {odds_inserted} em {duration:.1f}s")
                
                # Heartbeat individual
                await supabase.upsert_scraper_status(
                    scraper_name=scraper_name,
                    odds_collected=len(odds) if odds else 0,
                    odds_inserted=odds_inserted,
                    cycle_count=cycle
                )
                
            except asyncio.TimeoutError:
                log.error(f"{scraper_name} TIMEOUT (120s)")
                await supabase.upsert_scraper_status(
                    scraper_name=scraper_name,
                    error="Timeout após 120s",
                    cycle_count=cycle
                )
            except Exception as e:
                log.error(f"{scraper_name} ERROR: {e}")
                await supabase.upsert_scraper_status(
                    scraper_name=scraper_name,
                    error=str(e)[:500],
                    cycle_count=cycle
                )
        
        # Recarregar caches a cada 10 ciclos
        if cycle % 10 == 0:
            await resources.reload_caches()
        
        log.info(f"=== Cycle {cycle} complete ===")
        # Sem sleep - próximo ciclo imediato
```

### ecosystem.sequential.config.js

```javascript
module.exports = {
  apps: [
    {
      name: 'scraper-seq-light',
      script: 'standalone/run_sequential.py',
      interpreter: 'python3',
      args: '--mode light',
      cwd: __dirname,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 50,
      autorestart: true,
      env: { PYTHONUNBUFFERED: '1' }
    },
    {
      name: 'scraper-seq-heavy',
      script: 'standalone/run_sequential.py',
      interpreter: 'python3',
      args: '--mode heavy',
      cwd: __dirname,
      max_memory_restart: '500M',
      restart_delay: 10000,
      max_restarts: 10,
      kill_timeout: 150000,  // 2.5 min para terminar scraper atual
      autorestart: true,
      env: { PYTHONUNBUFFERED: '1' }
    },
    {
      name: 'json-generator',
      script: 'standalone/run_json_generator.py',
      interpreter: 'python3',
      args: '--interval 30',  // Aumentado de 15s
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 2000,
      max_restarts: 100,
      autorestart: true,
      env: { PYTHONUNBUFFERED: '1' }
    },
    {
      name: 'cleanup-service',
      script: 'standalone/run_cleanup.py',
      interpreter: 'python3',
      args: '--interval 300',
      cwd: __dirname,
      max_memory_restart: '50M',
      restart_delay: 5000,
      max_restarts: 100,
      autorestart: true,
      env: { PYTHONUNBUFFERED: '1' }
    }
  ]
};
```

