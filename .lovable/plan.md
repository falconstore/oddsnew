

# Plano: Migrar para Arquitetura PM2 com Scrapers Isolados

## Analise da Arquitetura Atual

Hoje o sistema roda em um unico processo:

```text
┌─────────────────────────────────────────────────────────────┐
│                  main.py (processo unico)                   │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator                                               │
│     └──► 23 scrapers em asyncio.gather()                    │
│          ├── Superbet (unified)                             │
│          ├── Estrelabet (unified)                           │
│          ├── KTO (unified)                                  │
│          ├── ... 20 outros scrapers                         │
│          └── TradeballScraper                               │
│                                                             │
│  → Se UM scraper trava, todo o ciclo atrasa                 │
│  → Se o processo morre, TUDO morre                          │
│  → Scrapers Playwright bloqueiam os HTTPX                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Nova Arquitetura Proposta: PM2 Multi-Processo

```text
┌─────────────────────────────────────────────────────────────┐
│                         PM2 DAEMON                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [CAMADA 1: Scrapers Independentes - Rodando em Paralelo]   │
│                                                             │
│  scraper-betano      ──► betano_standalone.py      (45mb)   │
│  scraper-superbet    ──► superbet_standalone.py    (40mb)   │
│  scraper-bet365      ──► bet365_standalone.py      (60mb)   │
│  scraper-novibet     ──► novibet_standalone.py     (38mb)   │
│  scraper-kto         ──► kto_standalone.py         (35mb)   │
│  scraper-stake       ──► stake_standalone.py       (40mb)   │
│  ... (1 processo por bookmaker)                             │
│                                                             │
│  Cada um:                                                   │
│  - Roda seu proprio loop infinito                           │
│  - Insere odds diretamente no Supabase                      │
│  - Se morrer, PM2 reinicia em <1s                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [CAMADA 2: Servico de Merge/JSON - Ciclo Independente]     │
│                                                             │
│  json-generator      ──► json_generator.py         (30mb)   │
│                                                             │
│  - Roda a cada 15-20s                                       │
│  - Le odds do Supabase                                      │
│  - Gera odds.json e faz upload                              │
│  - Detecta alertas de arbitragem                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [CAMADA 3: Manutencao - Ciclo Longo]                       │
│                                                             │
│  cleanup-service     ──► cleanup_standalone.py     (20mb)   │
│                                                             │
│  - Roda a cada 5 minutos                                    │
│  - Limpa matches antigos                                    │
│  - Recarrega caches se necessario                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Vantagens Tecnicas

| Aspecto | Atual (Monolitico) | PM2 (Distribuido) |
|---------|-------------------|-------------------|
| **Isolamento de Erros** | 1 erro = ciclo inteiro falha | 1 erro = apenas 1 bookmaker offline |
| **Velocidade** | Scrapers Playwright bloqueiam httpx | Todos rodam 100% paralelos |
| **Restart** | Ctrl+C mata tudo | Auto-restart por processo |
| **Boot da VPS** | Manual | `pm2 startup` = automatico |
| **Logs** | Arquivo unico misturado | `pm2 logs scraper-betano` isolado |
| **Monitoramento** | Dificil identificar gargalo | `pm2 monit` mostra CPU/RAM por scraper |
| **Deploy** | Derrubar tudo para atualizar | `pm2 reload scraper-betano` sem downtime |

---

## Arquivos a Criar

### 1. Estrutura de Pastas

```text
docs/scraper/
├── standalone/                    # NOVA PASTA
│   ├── run_scraper.py            # Runner generico
│   ├── run_json_generator.py     # Gerador de JSON
│   └── run_cleanup.py            # Servico de limpeza
│
├── ecosystem.config.js            # NOVO - Config PM2
│
├── scrapers/                      # Existente (sem mudanca)
├── orchestrator.py               # Mantido para debug/fallback
└── main.py                       # Mantido para debug/fallback
```

### 2. Arquivo: `standalone/run_scraper.py`

Script generico que recebe o nome do scraper como argumento:

```python
"""
Standalone Scraper Runner - Roda um unico scraper em loop infinito.

Uso: python run_scraper.py --scraper betano --interval 30
"""
import asyncio
import argparse
from loguru import logger

async def run_forever(scraper_class, interval: int):
    """Loop infinito para um unico scraper."""
    scraper = scraper_class()
    
    # Inicializar caches (TeamMatcher, LeagueMatcher)
    await initialize_shared_resources()
    
    await scraper.setup()
    
    while True:
        try:
            odds = await scraper.scrape_all()
            normalized = await normalize_and_insert(odds)
            logger.info(f"[{scraper.name}] {len(odds)} coletadas, {len(normalized)} inseridas")
        except Exception as e:
            logger.error(f"[{scraper.name}] Erro: {e}")
        
        await asyncio.sleep(interval)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--scraper", required=True)
    parser.add_argument("--interval", type=int, default=30)
    args = parser.parse_args()
    
    scraper_class = get_scraper_class(args.scraper)
    asyncio.run(run_forever(scraper_class, args.interval))
```

### 3. Arquivo: `ecosystem.config.js`

Configuracao do PM2:

```javascript
module.exports = {
  apps: [
    // === SCRAPERS HTTPX (Leves - 30s interval) ===
    {
      name: 'scraper-betano',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper betano --interval 30',
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
    },
    {
      name: 'scraper-superbet',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper superbet --interval 30',
      max_memory_restart: '100M',
    },
    {
      name: 'scraper-novibet',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper novibet --interval 30',
      max_memory_restart: '100M',
    },
    // ... outros scrapers HTTPX
    
    // === SCRAPERS PLAYWRIGHT (Pesados - 45s interval) ===
    {
      name: 'scraper-bet365',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper bet365 --interval 45',
      max_memory_restart: '200M',
    },
    {
      name: 'scraper-betbra',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper betbra --interval 45',
      max_memory_restart: '200M',
    },
    
    // === SERVICO JSON ===
    {
      name: 'json-generator',
      script: 'standalone/run_json_generator.py',
      interpreter: 'python3',
      args: '--interval 15',
      max_memory_restart: '100M',
    },
    
    // === CLEANUP ===
    {
      name: 'cleanup-service',
      script: 'standalone/run_cleanup.py',
      interpreter: 'python3',
      args: '--interval 300',
      max_memory_restart: '50M',
    },
  ],
};
```

### 4. Arquivo: `standalone/run_json_generator.py`

```python
"""
JSON Generator - Gera odds.json a cada ciclo.

Nao depende de nenhum scraper - le direto do Supabase.
"""
import asyncio
from loguru import logger
from supabase_client import SupabaseClient

async def run_forever(interval: int):
    supabase = SupabaseClient()
    
    while True:
        try:
            # Buscar odds de todas as tabelas
            football = await supabase.fetch_odds_for_json()
            nba = await supabase.fetch_nba_odds_for_json()
            
            # Gerar e fazer upload
            json_data = generate_json(football + nba)
            supabase.upload_odds_json(json_data)
            
            logger.info(f"JSON atualizado: {len(football)} football + {len(nba)} NBA")
        except Exception as e:
            logger.error(f"Erro ao gerar JSON: {e}")
        
        await asyncio.sleep(interval)
```

---

## Comandos PM2 Uteis

```bash
# Iniciar todos os processos
pm2 start ecosystem.config.js

# Ver status de todos
pm2 status

# Monitoramento em tempo real
pm2 monit

# Ver logs de um scraper especifico
pm2 logs scraper-betano --lines 50

# Reiniciar apenas um scraper (sem derrubar os outros)
pm2 restart scraper-novibet

# Parar um scraper problematico
pm2 stop scraper-bet365

# Configurar auto-start no boot da VPS
pm2 startup
pm2 save

# Atualizar codigo e reiniciar suavemente
pm2 reload all
```

---

## Beneficios Esperados

| Metrica | Antes | Depois |
|---------|-------|--------|
| **Tempo do ciclo** | 25-40s (serializado por Playwright) | 10-15s (100% paralelo) |
| **Recuperacao de erro** | Manual ou 20s+ | Automatico em <1s |
| **Identificar scraper lento** | Dificil | `pm2 monit` mostra cada um |
| **Atualizar 1 scraper** | Derrubar tudo | `pm2 reload scraper-x` |
| **Uso de memoria** | 1 processo grande | Distribuido, facil de limitar |

---

## Resumo das Mudancas

| Etapa | Arquivos | Descricao |
|-------|----------|-----------|
| 1 | `standalone/run_scraper.py` | Runner generico para qualquer scraper |
| 2 | `standalone/run_json_generator.py` | Servico dedicado para gerar JSON |
| 3 | `standalone/run_cleanup.py` | Servico de limpeza de matches antigos |
| 4 | `ecosystem.config.js` | Configuracao PM2 com todos os processos |
| 5 | `standalone/shared_resources.py` | Inicializacao compartilhada (caches) |
| 6 | Manter `main.py` e `orchestrator.py` | Fallback para debug local |

---

## Notas Tecnicas

1. **Caches Compartilhados**: Cada processo carrega seu proprio cache de teams/leagues. Como sao read-only, nao ha problema de concorrencia.

2. **Insercao no Supabase**: Cada scraper insere diretamente. O Supabase lida bem com insercoes concorrentes.

3. **Geracao de JSON**: Fica em processo separado, lendo do banco. Nao depende de nenhum scraper estar online.

4. **Connection Closed**: PM2 detecta a queda e reinicia. O `restart_delay: 3000` evita loop de restart rapido demais.

5. **Memoria**: `max_memory_restart` forca restart se um scraper vazar memoria.

Esta arquitetura transforma o sistema de "bloco monolitico" para "microservicos de scraping", maximizando resiliencia e velocidade.

