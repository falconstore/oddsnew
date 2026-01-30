
# Plano de Unificação: Aposta1 e Esportivabet Scrapers

## Resumo do Problema

Atualmente existem 4 processos separados rodando:
- `scraper-aposta1` (futebol)
- `scraper-aposta1-nba` (basquete)
- `scraper-esportivabet` (futebol)
- `scraper-esportivabet-nba` (basquete)

Cada processo abre sua própria sessão Playwright para capturar token, causando concorrência e erros de `asyncio.CancelledError`.

---

## Arquitetura Proposta

```text
ATUAL (4 processos separados):
┌─────────────────┬─────────────────┐
│ aposta1         │ esportivabet    │
│ (30s, Futebol)  │ (30s, Futebol)  │
├─────────────────┼─────────────────┤
│ aposta1-nba     │ esportivabet-nba│
│ (30s, NBA)      │ (30s, NBA)      │
└─────────────────┴─────────────────┘
= 4 capturas de token separadas

PROPOSTA (2 processos unificados):
┌───────────────────────────────────┐
│ aposta1 (unificado)               │
│ 1 Playwright -> Futebol + NBA     │
│ (60s, 150M)                       │
├───────────────────────────────────┤
│ esportivabet (unificado)          │
│ 1 Playwright -> Futebol + NBA     │
│ (60s, 150M)                       │
└───────────────────────────────────┘
= 2 capturas de token (50% menos processos)
```

---

## Etapas de Implementação

### Etapa 1: Criar `aposta1_unified_scraper.py`

Novo arquivo que combina a lógica de `aposta1_scraper.py` + `aposta1_nba_scraper.py`:

**Características:**
- Única captura de token via Playwright
- Mesma sessão curl_cffi para Futebol e NBA
- Guard Pattern no `setup()` para evitar re-inicialização
- Teardown robusto com try/except

**Estrutura:**
```python
class Aposta1UnifiedScraper(BaseScraper):
    FOOTBALL_LEAGUES = {...}  # Das configs atuais
    BASKETBALL_LEAGUES = {"nba": {...}}
    
    async def scrape_all(self):
        await self.setup()  # Guard pattern
        try:
            # 1. Scrape todas as ligas de futebol
            for league in FOOTBALL_LEAGUES:
                odds.extend(await self._scrape_football_league(league))
            
            # 2. Scrape NBA
            odds.extend(await self._scrape_basketball())
            
            return odds
        finally:
            await self.teardown()
```

### Etapa 2: Criar `esportivabet_unified_scraper.py`

Mesmo padrão do Aposta1 Unificado:
- Combinar `esportivabet_scraper.py` + `esportivabet_nba_scraper.py`
- Um único token/session para ambos os esportes
- Guard Pattern no setup

### Etapa 3: Atualizar `run_scraper.py`

Modificar o `SCRAPER_MAP` para usar os novos scrapers unificados:

```python
SCRAPER_MAP = {
    # ... outros
    "aposta1": ("scrapers.aposta1_unified_scraper", "Aposta1UnifiedScraper"),
    "esportivabet": ("scrapers.esportivabet_unified_scraper", "EsportivabetUnifiedScraper"),
    # Remover entradas _nba separadas
}
```

### Etapa 4: Atualizar `ecosystem.config.js`

**Alterações:**
- `scraper-aposta1`: intervalo 30s para 60s, memória 100M para 150M
- `scraper-aposta1-nba`: remover ou comentar
- `scraper-esportivabet`: intervalo 30s para 60s, memória 100M para 150M  
- `scraper-esportivabet-nba`: remover ou comentar

---

## Detalhes Técnicos

### Guard Pattern (Setup)

```python
async def setup(self) -> None:
    # Guard: evita re-inicialização
    if self.auth_token and self.session:
        return
    
    # Capturar token via Playwright
    # ...
```

### Teardown Robusto

```python
async def teardown(self) -> None:
    try:
        if self.session:
            await self.session.close()
    except Exception:
        pass
    self.session = None
    self.auth_token = None
```

### Scrape All com Tratamento de Erros

```python
async def scrape_all(self) -> List[ScrapedOdds]:
    all_odds = []
    await self.setup()
    
    try:
        # Futebol
        for key, config in self.FOOTBALL_LEAGUES.items():
            try:
                odds = await self._scrape_football_league(config)
                all_odds.extend(odds)
            except Exception as e:
                self.logger.error(f"Erro {config.name}: {e}")
        
        # Basquete
        try:
            odds = await self._scrape_basketball()
            all_odds.extend(odds)
        except Exception as e:
            self.logger.error(f"Erro NBA: {e}")
            
    finally:
        await self.teardown()
    
    return all_odds
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `docs/scraper/scrapers/aposta1_unified_scraper.py` | Criar (novo) |
| `docs/scraper/scrapers/esportivabet_unified_scraper.py` | Criar (novo) |
| `docs/scraper/standalone/run_scraper.py` | Atualizar SCRAPER_MAP |
| `docs/scraper/ecosystem.config.js` | Remover entradas -nba, ajustar intervalos |

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Processos Aposta1 + Esportivabet | 4 | 2 |
| Capturas de token Playwright | 4 | 2 |
| Erros de concorrência | Frequentes | Eliminados |

---

## Comandos para Deploy

Após as alterações, executar na VPS:

```bash
# Parar scrapers antigos
pm2 stop scraper-aposta1 scraper-aposta1-nba scraper-esportivabet scraper-esportivabet-nba

# Deletar entradas antigas
pm2 delete scraper-aposta1-nba scraper-esportivabet-nba

# Atualizar arquivos (git pull ou scp)

# Reiniciar com novo config
pm2 restart scraper-aposta1 scraper-esportivabet

# Verificar
pm2 status
pm2 logs scraper-aposta1 --lines 20

# Limpar tabela scraper_status
# No Supabase SQL Editor:
DELETE FROM public.scraper_status 
WHERE scraper_name IN ('aposta1_nba', 'esportivabet_nba');
```
