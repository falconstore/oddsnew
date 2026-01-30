

# Plano de Otimização dos Scrapers Playwright

## Resumo do Problema

Os scrapers Playwright (Betano, Betbra, Stake) estavam causando sobrecarga crítica no servidor (Load Average 27+ em 4 vCPUs) devido a:

1. **Intervalos muito curtos** (30-45s) para scrapers que usam browser
2. **Processos separados** para Futebol e NBA, duplicando instâncias Chrome
3. **Falta de Guard Pattern** nos scrapers Betano/Betbra (apenas Stake tem)
4. **Limits de memória inadequados** para scrapers Playwright

---

## Arquitetura Atual vs Proposta

```text
ATUAL (5 processos Playwright):
┌─────────────────┬─────────────────┬─────────────────┐
│ betano          │ betbra          │ stake           │
│ (30s, 100M)     │ (45s, 200M)     │ (30s, 400M)     │
├─────────────────┼─────────────────┼─────────────────┤
│ betano-nba      │ betbra-nba      │                 │
│ (30s, 100M)     │ (45s, 200M)     │                 │
└─────────────────┴─────────────────┴─────────────────┘
= 5 Chrome browsers simultâneos = Sobrecarga

PROPOSTA (2 processos Playwright):
┌─────────────────────────────────┬───────────────────┐
│ betano (unificado)              │ stake (já ok)     │
│ Futebol + NBA em 1 browser      │ Futebol + NBA     │
│ (120s, 300M)                    │ (120s, 400M)      │
└─────────────────────────────────┴───────────────────┘
= 2 Chrome browsers = Estável
```

---

## Etapas de Implementação

### Etapa 1: Ajustar Intervalos e Limites (Imediato)

Atualizar `ecosystem.config.js` com intervalos maiores para os scrapers Playwright:

**Alterações:**
- `betano`: intervalo 30s para 120s, memória 100M para 300M
- `betano-nba`: desabilitar (será unificado)
- `betbra`: intervalo 45s para 120s, memória 200M para 300M
- `betbra-nba`: desabilitar (será unificado)
- `stake`: intervalo 30s para 120s (já tem 400M)

### Etapa 2: Criar Scraper Betano Unificado

Criar novo arquivo `betano_unified_scraper.py` que:
- Coleta Futebol + NBA em uma única sessão Playwright
- Implementa Guard Pattern (como o Stake)
- Gerencia setup/teardown internamente no `scrape_all()`

**Estrutura do código:**
```python
class BetanoUnifiedScraper(BaseScraper):
    # Combina LEAGUES de futebol e NBA
    FOOTBALL_LEAGUES = {...}  # Das configs atuais
    BASKETBALL_LEAGUES = {"nba": {...}}
    
    async def scrape_all(self):
        await self.setup()  # Guard pattern
        try:
            # Scrape futebol
            for league in FOOTBALL_LEAGUES:
                odds.extend(await self._scrape_football_league(league))
            # Scrape NBA
            odds.extend(await self._scrape_nba())
            return odds
        finally:
            await self.teardown()
```

### Etapa 3: Criar Scraper Betbra Unificado

Mesmo padrão do Betano Unificado:
- Combinar `betbra_scraper.py` + `betbra_nba_scraper.py`
- Um único browser para ambos os esportes
- Guard Pattern no setup

### Etapa 4: Atualizar Mapeamento no Runner

Atualizar `run_scraper.py` para usar os novos scrapers unificados:
```python
SCRAPER_MAP = {
    "betano": ("scrapers.betano_unified_scraper", "BetanoUnifiedScraper"),
    "betbra": ("scrapers.betbra_unified_scraper", "BetbraUnifiedScraper"),
    # ... outros
}
```

### Etapa 5: Remover Entradas Obsoletas

No `ecosystem.config.js`:
- Remover ou comentar `scraper-betano-nba`
- Remover ou comentar `scraper-betbra-nba`

---

## Detalhes Técnicos

### Guard Pattern (Já implementado no Stake)

```python
async def setup(self):
    # Guard: evita re-inicialização
    if self._page is not None:
        return
    
    # ... criar browser
```

### Teardown Robusto

```python
async def teardown(self):
    # Fechar aiohttp session (se usar)
    try:
        if self._session:
            await self._session.close()
    except Exception:
        pass
    self._session = None
    
    # Fechar page
    try:
        if self._page:
            await self._page.close()
    except Exception:
        pass
    self._page = None
    
    # ... context e browser
```

### Configurações PM2 Otimizadas

```javascript
{
    name: 'scraper-betano',
    args: '--scraper betano --interval 120',
    max_memory_restart: '300M',
    restart_delay: 10000,
    max_restarts: 5,
    min_uptime: 30000,
    kill_timeout: 30000,
}
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Processos Chrome simultâneos | 5 | 2 |
| Ciclos por minuto (Playwright) | ~10 | ~1 |
| RAM estimada (Playwright) | ~2GB | ~700MB |
| Load Average esperado | 4-8 | 1-2 |

---

## Ordem de Execução Recomendada

1. **Manter scrapers Playwright parados** por enquanto
2. **Criar scrapers unificados** (Betano + Betbra)
3. **Atualizar ecosystem.config.js** com novos intervalos
4. **Testar um scraper por vez** (iniciar apenas stake com 120s)
5. **Monitorar load** por 5-10 minutos
6. **Adicionar próximo scraper** se estável

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `docs/scraper/scrapers/betano_unified_scraper.py` | Criar (novo) |
| `docs/scraper/scrapers/betbra_unified_scraper.py` | Criar (novo) |
| `docs/scraper/standalone/run_scraper.py` | Atualizar SCRAPER_MAP |
| `docs/scraper/ecosystem.config.js` | Atualizar intervalos e remover -nba |

