# 🎯 Odds Scraper - Sistema de Coleta de Odds

Sistema Python para coleta automatizada de odds de apostas esportivas de múltiplas casas de apostas.

## 📁 Estrutura do Projeto

```
odds-scraper/
├── .env                    # Variáveis de ambiente (NÃO versionar!)
├── requirements.txt        # Dependências Python
├── config.py              # Configurações e constantes
├── main.py                # Entry point da aplicação
├── orchestrator.py        # Gerenciador de execução paralela
├── base_scraper.py        # Classe base para scrapers
├── supabase_client.py     # Cliente de banco de dados
├── team_matcher.py        # Fuzzy matching de nomes
└── scrapers/              # Implementações específicas
    ├── __init__.py
    ├── betano.py
    ├── bet365.py
    ├── sportingbet.py
    ├── betfair.py
    └── onexbet.py
```

## 🚀 Instalação

### 1. Requisitos do Sistema

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y python3.10 python3-pip chromium-browser

# Verificar versão do Python
python3 --version  # Deve ser 3.10+
```

### 2. Configurar Ambiente Virtual

```bash
# Criar e ativar ambiente virtual
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Instalar dependências
pip install -r requirements.txt

# Instalar navegador do Playwright
playwright install chromium
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Supabase (obtenha em: Settings > API no Supabase Dashboard)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Configurações de Scraping
SCRAPE_INTERVAL_SECONDS=60
STALE_DATA_THRESHOLD_MINUTES=30

# Logging
LOG_LEVEL=INFO
LOG_FILE=scraper.log

# Alertas
VALUE_BET_THRESHOLD=5.0
ARBITRAGE_THRESHOLD=0.0
```

⚠️ **IMPORTANTE**: Use a `service_role` key (não a `anon` key) para o scraper ter acesso completo às tabelas.

## 🏃 Executar

### Modo Desenvolvimento (uma execução)

```bash
python main.py --once --debug
```

### Modo Produção (loop contínuo)

```bash
python main.py
```

### Com Intervalo Customizado

```bash
python main.py --interval 120  # A cada 2 minutos
```

### Em Background (nohup)

```bash
nohup python main.py > /dev/null 2>&1 &
```

### Como Serviço (systemd)

Crie `/etc/systemd/system/odds-scraper.service`:

```ini
[Unit]
Description=Odds Scraper Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/odds-scraper
Environment=PATH=/home/ubuntu/odds-scraper/venv/bin
ExecStart=/home/ubuntu/odds-scraper/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable odds-scraper
sudo systemctl start odds-scraper
sudo systemctl status odds-scraper
```

## 🔧 Implementar um Novo Scraper

### 1. Criar arquivo do scraper

```python
# scrapers/betano.py
from playwright.async_api import async_playwright
from base_scraper import BaseScraper, ScrapedOdds, LeagueConfig
from config import BOOKMAKERS, LEAGUE_CONFIGS

class BetanoScraper(BaseScraper):
    def __init__(self):
        config = BOOKMAKERS["betano"]
        super().__init__(config["name"], config["base_url"])
        self._browser = None
        self._page = None
    
    async def setup(self):
        """Inicializa o browser."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=True)
        self._page = await self._browser.new_page()
    
    async def teardown(self):
        """Fecha o browser."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
    
    async def get_available_leagues(self) -> list[LeagueConfig]:
        """Retorna ligas configuradas para Betano."""
        leagues = []
        for league_id, config in LEAGUE_CONFIGS.items():
            if "betano" in config["urls"]:
                leagues.append(LeagueConfig(
                    league_id=league_id,
                    name=config["name"],
                    url=self.base_url + config["urls"]["betano"],
                    country=config["country"]
                ))
        return leagues
    
    async def scrape_league(self, league: LeagueConfig) -> list[ScrapedOdds]:
        """Coleta odds de uma liga específica."""
        odds_list = []
        
        await self._page.goto(league.url, wait_until="networkidle")
        await self._page.wait_for_selector('[data-qa="event-row"]', timeout=10000)
        
        events = await self._page.query_selector_all('[data-qa="event-row"]')
        
        for event in events:
            try:
                # Extrair dados (ajustar seletores conforme o site)
                home_el = await event.query_selector('[data-qa="home-team"]')
                away_el = await event.query_selector('[data-qa="away-team"]')
                odds_els = await event.query_selector_all('[data-qa="odd-value"]')
                date_el = await event.query_selector('[data-qa="event-date"]')
                
                if home_el and away_el and len(odds_els) >= 3:
                    home_team = await home_el.inner_text()
                    away_team = await away_el.inner_text()
                    date_text = await date_el.inner_text() if date_el else ""
                    
                    odds_list.append(ScrapedOdds(
                        bookmaker_name=self.name,
                        home_team_raw=home_team.strip(),
                        away_team_raw=away_team.strip(),
                        league_raw=league.name,
                        match_date=self._parse_date(date_text),
                        home_odd=self._parse_odds(await odds_els[0].inner_text()),
                        draw_odd=self._parse_odds(await odds_els[1].inner_text()),
                        away_odd=self._parse_odds(await odds_els[2].inner_text()),
                    ))
            except Exception as e:
                self.logger.warning(f"Erro ao processar evento: {e}")
        
        return odds_list
```

### 2. Registrar no Orchestrator

```python
# main.py
from scrapers.betano import BetanoScraper

def create_orchestrator() -> Orchestrator:
    orchestrator = Orchestrator()
    orchestrator.register_scraper(BetanoScraper())
    # ... outros scrapers
    return orchestrator
```

## 📊 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                         VPS                                  │
├─────────────────────────────────────────────────────────────┤
│  main.py                                                    │
│     │                                                       │
│     ▼                                                       │
│  Orchestrator                                               │
│     │                                                       │
│     ├──► BetanoScraper ──► HTML ──► ScrapedOdds            │
│     ├──► Bet365Scraper ──► HTML ──► ScrapedOdds            │
│     └──► SportingbetScraper ──► HTML ──► ScrapedOdds       │
│              │                                              │
│              ▼                                              │
│         TeamMatcher (fuzzy matching)                        │
│              │                                              │
│              ▼                                              │
│         Normalização (team_id, league_id, match_id)        │
│              │                                              │
│              ▼                                              │
│         AlertDetector (arbitragem, value bets)             │
│              │                                              │
│              ▼                                              │
│         SupabaseClient.insert_odds()                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Supabase                              │
├─────────────────────────────────────────────────────────────┤
│  odds_history, matches, teams, team_aliases, alerts        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Lovable Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│  React App ──► Supabase Client ──► Visualização            │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Debugging

### Ver logs em tempo real

```bash
tail -f scraper.log
```

### Testar um scraper individualmente

```python
# test_scraper.py
import asyncio
from scrapers.betano import BetanoScraper

async def test():
    scraper = BetanoScraper()
    await scraper.setup()
    
    leagues = await scraper.get_available_leagues()
    print(f"Ligas disponíveis: {len(leagues)}")
    
    for league in leagues[:1]:  # Testar apenas primeira liga
        odds = await scraper.scrape_league(league)
        print(f"{league.name}: {len(odds)} jogos")
        for o in odds[:3]:
            print(f"  {o.home_team_raw} vs {o.away_team_raw}: {o.home_odd}/{o.draw_odd}/{o.away_odd}")
    
    await scraper.teardown()

asyncio.run(test())
```

## ⚠️ Considerações Importantes

1. **Rate Limiting**: Adicione delays entre requisições para evitar bloqueios
2. **Proxies**: Para produção, considere usar rotação de proxies
3. **User Agents**: Alterne user agents para parecer tráfego natural
4. **Seletores**: Os seletores CSS podem mudar - monitore e atualize
5. **Termos de Uso**: Verifique os termos de uso de cada site
6. **Backup**: Faça backup do banco de dados regularmente

## 📞 Suporte

- Logs detalhados em `scraper.log`
- Use `--debug` para mais informações
- Verifique a conexão com Supabase antes de reportar problemas
