

# Modo Híbrido - 2 Scrapers em Paralelo

## Situação Atual

| Métrica | Valor |
|---------|-------|
| Load Average | 1.48 |
| Tempo por ciclo | ~229s (3.8 min) |
| vCPUs disponíveis | 8 |
| RAM livre | 29GB |

Com apenas 1 scraper rodando por vez, você usa ~15% da capacidade. Rodar 2 em paralelo pode reduzir o tempo de ciclo pela metade.

## Proposta: Modo Paralelo por Pares

Executar **1 scraper leve + 1 pesado simultaneamente**, aproveitando que:
- Scrapers leves usam CPU mínimo (HTTP requests)
- Scrapers pesados usam 1 Chrome (~1-2 núcleos)
- Total estimado: 2-3 núcleos por par (load ~3-5)

### Estrutura de Pares

```text
Par 1: superbet + betano      (HTTPX + Playwright)
Par 2: novibet + betbra       (HTTPX + Playwright)
Par 3: kto + stake            (HTTPX + Playwright)
Par 4: estrelabet + aposta1   (HTTPX + Playwright)
Par 5: sportingbet + esportivabet (HTTPX + Playwright)
Par 6: betnacional (solo)
Par 7: br4bet + mcgames       (HTTPX + HTTPX) -- leves em paralelo
Par 8: jogodeouro + tradeball (HTTPX + HTTPX)
Par 9: bet365 (solo)          -- API mais lenta
Par 10: br4bet_nba + mcgames_nba + jogodeouro_nba (3 leves)
```

### Estimativa de Performance

| Modo | Tempo Ciclo | Load Esperado |
|------|-------------|---------------|
| Sequencial atual | ~229s | 1.5 |
| Híbrido (pares) | ~120-150s | 3-5 |

**Redução de ~40-50% no tempo de ciclo!**

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `run_sequential.py` | Adicionar modo "hybrid" com execução em pares via asyncio.gather() |
| `ecosystem.sequential.config.js` | Adicionar opção --mode hybrid |

## Implementação

### 1. Nova estrutura de pares em run_sequential.py

```python
# Pares otimizados: sempre 1 leve + 1 pesado quando possível
HYBRID_PAIRS = [
    # (leve, pesado) - rodam em paralelo
    ("superbet", "betano"),
    ("novibet", "betbra"),
    ("kto", "stake"),
    ("estrelabet", "aposta1"),
    ("sportingbet", "esportivabet"),
    
    # Leves solo ou em grupo (baixo impacto)
    ("betnacional",),
    ("br4bet", "mcgames"),
    ("jogodeouro", "tradeball"),
    ("bet365",),
    
    # NBA (todos leves, podem rodar juntos)
    ("br4bet_nba", "mcgames_nba", "jogodeouro_nba"),
]
```

### 2. Nova função run_hybrid()

```python
async def run_hybrid(pairs: List[tuple], log):
    """
    Executa scrapers em pares paralelos.
    Cada par executa simultaneamente via asyncio.gather().
    """
    from shared_resources import get_shared_resources
    from normalizer import OddsNormalizer
    from supabase_client import SupabaseClient
    
    resources = await get_shared_resources()
    normalizer = OddsNormalizer(resources)
    supabase = SupabaseClient()
    
    cycle = 0
    
    while True:
        cycle += 1
        cycle_start = time.time()
        
        log.info(f"CYCLE {cycle} - HYBRID MODE ({len(pairs)} pairs)")
        
        resources.team_matcher.clear_log_cache()
        
        if cycle % 10 == 0:
            await resources.reload_caches()
        
        total_collected = 0
        total_inserted = 0
        
        # Executar pares sequencialmente, mas scrapers do par em paralelo
        for pair in pairs:
            try:
                # Criar tasks para todos scrapers do par
                tasks = [
                    run_single_scraper(s, normalizer, supabase, cycle, log)
                    for s in pair
                ]
                
                # Executar par em paralelo
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Agregar métricas
                for r in results:
                    if isinstance(r, dict):
                        total_collected += r.get("odds_collected", 0)
                        total_inserted += r.get("odds_inserted", 0)
                
                # Cooldown de 2s entre pares pesados
                if any(s in HEAVY_SCRAPERS for s in pair):
                    await asyncio.sleep(2)
                    
            except asyncio.CancelledError:
                log.info("Shutdown during cycle")
                return
        
        cycle_duration = time.time() - cycle_start
        log.info(f"CYCLE {cycle} COMPLETE in {cycle_duration:.1f}s")
```

### 3. Atualização do parse_args e get_scrapers_for_mode

```python
def parse_args():
    parser.add_argument(
        "--mode",
        choices=["all", "light", "heavy", "hybrid"],  # Adicionar hybrid
        default="all",
        ...
    )

def get_scrapers_for_mode(mode: str, ...):
    if mode == "hybrid":
        return HYBRID_PAIRS  # Retorna lista de tuplas
```

### 4. Atualização do ecosystem.sequential.config.js

```javascript
{
  name: 'scraper-hybrid',
  script: 'standalone/run_sequential.py',
  interpreter: 'python3',
  args: '--mode hybrid',  // Novo modo
  // ... resto igual
}
```

## Teste Recomendado

Antes de aplicar, você pode testar manualmente:

```bash
# Testar um par específico
python -c "
import asyncio
from run_sequential import run_single_scraper, get_shared_resources
# ... código de teste
"
```

## Rollback

Se o load ficar alto demais (>6), basta trocar para o modo sequencial:

```bash
# No ecosystem:
args: '--mode all'  # Volta ao sequencial
```

## Resumo

| Mudança | Benefício |
|---------|-----------|
| Modo hybrid com pares | Ciclo ~50% mais rápido |
| Cooldown entre pares pesados | Evita picos de CPU |
| Leves agrupados | Aproveita tempo ocioso |

Tempo estimado: ~120-150s por ciclo vs ~229s atual.

