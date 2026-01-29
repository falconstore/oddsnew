
# Correcao Urgente: Reverter Mudancas que Bugaram Todos os Scrapers

## Diagnostico

Analisando o codigo atual e os screenshots, identifiquei que:

1. **O `ecosystem.config.js` esta CORRETO** - nao foi ele que causou o problema
2. **O problema sao as mudancas no `run_scraper.py`** que afetaram TODOS os scrapers
3. **O Stake scraper com 10 paginas paralelas** tambem esta consumindo recursos demais

## O Que Mudamos Que Quebrou Tudo

### Mudanca 1: `run_scraper.py` (linha 162)
```python
# ANTES: Nao tinha isso
await scraper.setup()  # <-- ISSO FOI ADICIONADO

# PROBLEMA: Muitos scrapers NAO TEM metodo setup() ou tem setup() diferente
```

**Por que quebrou?** O `run_scraper.py` agora chama `await scraper.setup()` na linha 162 ANTES do loop. Scrapers como:
- `BetbraScraper` - pode nao ter setup() compativel
- `TradeballScraper` - usa autenticacao diferente
- `Bet365Scraper` - ja faz setup dentro de scrape_all()
- `NovibetScraper` - usa curl_cffi, nao Playwright

Isso faz com que alguns scrapers falhem imediatamente ao iniciar.

### Mudanca 2: Signal handlers (linhas 17, 30-37, 284-286)
```python
import signal
shutdown_requested = False

def request_shutdown(signum, frame):
    global shutdown_requested
    shutdown_requested = True

# E no main():
signal.signal(signal.SIGTERM, request_shutdown)
signal.signal(signal.SIGINT, request_shutdown)
```

**Isso em si nao e problema**, mas o loop `while not shutdown_requested` pode estar causando comportamento inesperado.

### Mudanca 3: `stake_scraper.py` com pool de 10 paginas
O pool de 10 paginas do Playwright esta criando muitos processos Chromium e consumindo toda a RAM da VPS, causando OOM (Out of Memory) que afeta outros scrapers.

---

## Solucao: Reverter para Versao Estavel

### Arquivo 1: `docs/scraper/standalone/run_scraper.py`

Reverter para a versao que:
1. NAO chama `scraper.setup()` antes do loop
2. Chama setup/teardown DENTRO de cada ciclo (como era antes)
3. Remove os signal handlers se estiverem causando problemas

```python
async def run_forever(scraper_name: str, interval: int, log: logger):
    """Loop infinito para um único scraper."""
    from shared_resources import get_shared_resources
    from normalizer import OddsNormalizer
    from supabase_client import SupabaseClient
    
    log.info(f"Starting standalone scraper: {scraper_name}")
    log.info(f"Interval: {interval}s")
    
    # Inicializar recursos compartilhados
    resources = await get_shared_resources()
    normalizer = OddsNormalizer(resources)
    supabase = SupabaseClient()
    
    # Obter bookmaker_id para o scraper
    bookmaker_name = scraper_name.replace("_nba", "").replace("-nba", "")
    bookmaker_id = await supabase.get_bookmaker_id(bookmaker_name)
    
    # Criar instância do scraper
    scraper_class = get_scraper_class(scraper_name)
    scraper = scraper_class()
    
    # NAO chamar setup() aqui - deixar o scraper gerenciar
    
    cycle_count = 0
    
    while True:  # Loop simples, sem shutdown_requested
        cycle_count += 1
        start_time = datetime.now(timezone.utc)
        error_message = None
        odds_collected = 0
        odds_inserted = 0
        
        try:
            # Limpar cache
            resources.team_matcher.clear_log_cache()
            
            # Recarregar caches a cada 10 ciclos
            if cycle_count % 10 == 0:
                await resources.reload_caches()
            
            # Executar scraping (scraper gerencia seu proprio setup/teardown)
            odds = await scraper.scrape_all()
            odds_collected = len(odds) if odds else 0
            
            if odds:
                football, nba = await normalizer.normalize_and_insert(odds)
                odds_inserted = football + nba
                log.info(f"[Cycle {cycle_count}] Collected: {odds_collected}, Inserted: {odds_inserted}")
            else:
                log.warning(f"[Cycle {cycle_count}] No odds collected")
                
        except Exception as e:
            error_message = str(e)[:500]
            log.error(f"[Cycle {cycle_count}] Error: {e}")
        
        # Enviar heartbeat
        try:
            await supabase.upsert_scraper_status(
                scraper_name=scraper_name,
                bookmaker_id=bookmaker_id,
                odds_collected=odds_collected,
                odds_inserted=odds_inserted,
                cycle_count=cycle_count,
                error=error_message
            )
        except Exception as hb_error:
            log.warning(f"Failed to send heartbeat: {hb_error}")
        
        await asyncio.sleep(interval)
```

### Arquivo 2: `docs/scraper/scrapers/stake_scraper.py`

Reverter para versao anterior COM pool de paginas, MAS:
1. Reduzir pool de 10 para 5 paginas (menos memoria)
2. Manter guard no setup() para evitar reinicializacao
3. Garantir que scrape_all() faca seu proprio setup/teardown

```python
def __init__(self):
    super().__init__(name="stake", base_url="https://stake.bet.br")
    # ...
    self._pool_size = 5  # Reduzido de 10 para 5

async def scrape_all(self) -> List[ScrapedOdds]:
    """Scrape all leagues for both sports."""
    all_odds = []
    
    # Setup controlado pelo proprio scraper
    await self.setup()
    
    try:
        # Football
        for league_id, config in self.FOOTBALL_LEAGUES.items():
            try:
                odds = await self._scrape_football(config)
                all_odds.extend(odds)
            except Exception as e:
                self.logger.error(f"[Stake] Erro na liga {config['name']}: {e}")
        
        # Basketball
        for league_id, config in self.BASKETBALL_LEAGUES.items():
            try:
                odds = await self._scrape_basketball(config)
                all_odds.extend(odds)
            except Exception as e:
                self.logger.error(f"[Stake] Erro na liga {config['name']}: {e}")
    
    finally:
        # Teardown ao final de cada ciclo
        await self.teardown()
    
    return all_odds
```

---

## Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `run_scraper.py` | REMOVER `await scraper.setup()` da linha 162 |
| `run_scraper.py` | Mudar `while not shutdown_requested` para `while True` |
| `run_scraper.py` | REMOVER signal handlers e graceful shutdown (opcional) |
| `stake_scraper.py` | Reduzir `_pool_size` de 10 para 5 |
| `stake_scraper.py` | Restaurar `await self.setup()` e `await self.teardown()` dentro de `scrape_all()` |

---

## Apos as Correcoes

Na VPS, execute:
```bash
# Parar todos os scrapers
pm2 stop all

# Atualizar codigo
git pull  # ou copiar arquivos

# Reiniciar todos
pm2 restart all

# Monitorar
pm2 monit
```

Os scrapers devem voltar a funcionar como antes.
