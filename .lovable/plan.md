

# Plano: Unificar Scrapers Mcgames e Jogo de Ouro (Futebol + NBA) e Corrigir Conexao

## Contexto

Atualmente existem **4 scrapers separados** que precisam ser consolidados em **2 scrapers unificados**:

- `mcgames_scraper.py` (futebol) + `mcgames_nba_scraper.py` (NBA) --> `mcgames_unified_scraper.py`
- `jogodeouro_scraper.py` (futebol) + `jogodeouro_nba_scraper.py` (NBA) --> `jogodeouro_unified_scraper.py`

Alem disso, o scraper da Jogo de Ouro tem problemas de conexao frequentes (timeout ao capturar token via Playwright).

## Beneficios da Unificacao

| Antes | Depois |
|-------|--------|
| 4 processos PM2 separados | 2 processos PM2 |
| 2 capturas de token Playwright por casa | 1 captura por casa |
| 4 sessoes HTTP | 2 sessoes HTTP |
| Mcgames: 2 processos Chrome | 1 processo Chrome |
| Jogo de Ouro: 2 processos Chrome | 1 processo Chrome |

---

## Parte 1: Mcgames Unified Scraper

Criar `docs/scraper/scrapers/mcgames_unified_scraper.py` seguindo o padrao ja usado em `aposta1_unified_scraper.py` e `esportivabet_unified_scraper.py`.

### Estrutura

```text
McgamesUnifiedScraper
  - FOOTBALL_LEAGUES (17 ligas, inclui todas do mcgames_scraper.py)
  - BASKETBALL_LEAGUES (NBA, champ_id 2980)
  - setup(): 1 unica captura de token via Playwright
  - scrape_all(): Futebol + NBA em sequencia
  - _scrape_football_league(): market typeId=1 (1x2)
  - _scrape_basketball_league(): market typeId=219 (Moneyline)
  - teardown(): fecha session, limpa estado
```

### Detalhes tecnicos

- Usa o mesmo `API_BASE` e `integration=mcgames2` para ambos os esportes
- Futebol: `typeId=1` para mercado 1x2, odds typeId 1/2/3 (home/draw/away)
- NBA: `typeId=219` para mercado Moneyline, odds typeId 1/3 (home/away), draw_odd=None
- Token e session compartilhados entre futebol e NBA
- Mesma variavel de ambiente `MCGAMES_AUTH_TOKEN` como fallback manual
- Warm-up URLs: usa as URLs de futebol (mais estaveis) para captura de token

---

## Parte 2: Jogo de Ouro Unified Scraper

Criar `docs/scraper/scrapers/jogodeouro_unified_scraper.py` seguindo o mesmo padrao.

### Estrutura

```text
JogodeOuroUnifiedScraper
  - FOOTBALL_LEAGUES (17 ligas, inclui todas do jogodeouro_scraper.py)
  - BASKETBALL_LEAGUES (NBA, champ_id 2980)
  - setup(): 1 unica captura de token com melhorias de resiliencia
  - scrape_all(): Futebol + NBA em sequencia
  - _scrape_football_league(): market typeId=1 (1x2)
  - _scrape_basketball_league(): market typeId=219 (Moneyline)
  - teardown(): fecha session, limpa estado
```

### Correcao do problema de conexao

O scraper atual da Jogo de Ouro tem problemas frequentes de timeout na captura do token. As melhorias serao:

1. **Timeout reduzido por URL**: de 60s para 20s (falhar rapido, tentar proxima URL)
2. **Mais URLs de warm-up**: adicionar URLs especificas de ligas populares que carregam mais rapido
3. **Argumentos Chrome otimizados**: adicionar `--single-process`, `--disable-gpu`, `--memory-pressure-off` (mesmo padrao dos scrapers Playwright otimizados)
4. **Viewport reduzido**: 800x600 em vez de tamanho padrao (menos recursos)
5. **Retry no scrape_all()**: se o token falhar no setup(), tenta uma vez mais apos limpar estado
6. **Fallback robusto para env var**: `JOGODEOURO_AUTH_TOKEN` ja existente, mas com logging melhorado

---

## Parte 3: Atualizacao dos Registros (run_sequential, ecosystem, __init__)

### 3.1 - `docs/scraper/standalone/run_sequential.py`

**Atualizar SCRAPER_MAP** em `get_scraper_class()`:

```python
# Substituir entradas separadas por unificadas
"mcgames": ("scrapers.mcgames_unified_scraper", "McgamesUnifiedScraper"),
"jogodeouro": ("scrapers.jogodeouro_unified_scraper", "JogodeOuroUnifiedScraper"),
```

**Remover das listas**:
- `LIGHT_SCRAPERS`: remover "mcgames_nba" e "jogodeouro_nba"
- `ALL_SCRAPERS_INTERLEAVED`: remover "mcgames_nba" e "jogodeouro_nba"  
- `HYBRID_TRIPLETS`: remover "mcgames_nba" e "jogodeouro_nba" do ultimo triplet de NBA

### 3.2 - `docs/scraper/standalone/run_scraper.py`

**Atualizar SCRAPER_MAP**:

```python
"mcgames": ("scrapers.mcgames_unified_scraper", "McgamesUnifiedScraper"),
"jogodeouro": ("scrapers.jogodeouro_unified_scraper", "JogodeOuroUnifiedScraper"),
```

Remover entradas `mcgames_nba` e `jogodeouro_nba`.

### 3.3 - `docs/scraper/ecosystem.config.js`

- **Remover** processo `scraper-mcgames-nba`
- **Remover** processo `scraper-jogodeouro-nba`
- **Atualizar** `scraper-mcgames`: mudar interval de 30s para 120s (agora e hibrido Playwright + curl_cffi)
- **Atualizar** `scraper-jogodeouro`: mudar interval de 30s para 120s, adicionar `--initial-delay 120` e aumentar max_memory para 200M

### 3.4 - `docs/scraper/scrapers/__init__.py`

Atualizar `__all__` para incluir os novos scrapers unificados e remover os antigos separados.

---

## Resumo de Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `docs/scraper/scrapers/mcgames_unified_scraper.py` |
| Criar | `docs/scraper/scrapers/jogodeouro_unified_scraper.py` |
| Editar | `docs/scraper/standalone/run_sequential.py` |
| Editar | `docs/scraper/standalone/run_scraper.py` |
| Editar | `docs/scraper/ecosystem.config.js` |
| Editar | `docs/scraper/scrapers/__init__.py` |

Os arquivos antigos (`mcgames_scraper.py`, `mcgames_nba_scraper.py`, `jogodeouro_scraper.py`, `jogodeouro_nba_scraper.py`) serao mantidos no repositorio para referencia, mas nao serao mais usados pelos runners.

---

## Secao Tecnica

### Padrao scrape_all() (obrigatorio)

Todos os scrapers unificados devem implementar `scrape_all()` que:
1. Chama `setup()` uma vez (captura token)
2. Itera por todas as ligas de futebol
3. Itera por todas as ligas de basquete
4. Chama `teardown()` no finally
5. Retorna `List[ScrapedOdds]`

### API Altenar (compartilhada por Mcgames e Jogo de Ouro)

Ambos usam a mesma API Altenar (`sb2frontend-altenar2.biahosted.com`), diferindo apenas no parametro `integration`:
- Mcgames: `integration=mcgames2`
- Jogo de Ouro: `integration=jogodeouro`

Os championship IDs sao os mesmos para ambos (ex: NBA = 2980, Premier League = 2936).

### Correcao de conexao Jogo de Ouro - detalhes

O problema principal e que o site jogodeouro.bet.br tem protecoes anti-bot mais agressivas e carrega lentamente. As melhorias no setup():

```text
Antes:
  - 3 URLs com timeout de 60s cada
  - Espera 3s + scroll + 2s + scroll + 2s por URL
  - Total maximo: ~210s (muito lento, frequentemente da timeout no PM2)

Depois:
  - 4 URLs com timeout de 20s cada  
  - Espera 2s + scroll + 1.5s por URL
  - Chrome otimizado (--single-process, viewport 800x600)
  - Total maximo: ~90s (dentro do timeout de 120s do PM2)
```

### Deploy

1. git pull no VPS
2. `pm2 stop scraper-mcgames scraper-mcgames-nba scraper-jogodeouro scraper-jogodeouro-nba`
3. `pm2 delete scraper-mcgames-nba scraper-jogodeouro-nba`
4. `pm2 start ecosystem.config.js --only scraper-mcgames,scraper-jogodeouro`
5. Verificar logs: `pm2 logs scraper-mcgames --lines 30` e `pm2 logs scraper-jogodeouro --lines 30`
6. Confirmar que aparece "Total: X futebol + Y NBA" nos logs

