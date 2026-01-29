# PM2 Standalone Architecture

Esta pasta contém os scripts para execução distribuída via PM2.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         PM2 DAEMON                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [CAMADA 1: Scrapers Independentes]                         │
│                                                             │
│  scraper-betano      ──► run_scraper.py --scraper betano    │
│  scraper-superbet    ──► run_scraper.py --scraper superbet  │
│  scraper-bet365      ──► run_scraper.py --scraper bet365    │
│  ... (1 processo por bookmaker)                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [CAMADA 2: Serviço de JSON]                                │
│                                                             │
│  json-generator      ──► run_json_generator.py              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [CAMADA 3: Manutenção]                                     │
│                                                             │
│  cleanup-service     ──► run_cleanup.py                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `run_scraper.py` | Runner genérico para qualquer scraper |
| `run_json_generator.py` | Serviço de geração de JSON |
| `run_cleanup.py` | Serviço de limpeza de matches |
| `shared_resources.py` | Caches e recursos compartilhados |
| `normalizer.py` | Normalização e inserção de odds |

## Comandos PM2

```bash
# Iniciar todos os processos
pm2 start ecosystem.config.js

# Ver status de todos
pm2 status

# Monitoramento em tempo real
pm2 monit

# Ver logs de um scraper específico
pm2 logs scraper-betano --lines 50

# Reiniciar apenas um scraper
pm2 restart scraper-novibet

# Parar um scraper problemático
pm2 stop scraper-bet365

# Configurar auto-start no boot da VPS
pm2 startup
pm2 save

# Reload suave (sem derrubar)
pm2 reload all

# Parar todos
pm2 stop all

# Deletar todos os processos
pm2 delete all
```

## Teste Individual

```bash
# Testar um scraper manualmente
cd docs/scraper
python standalone/run_scraper.py --scraper betano --interval 30 --debug

# Testar gerador de JSON
python standalone/run_json_generator.py --interval 15 --debug

# Testar cleanup
python standalone/run_cleanup.py --interval 60 --debug
```

## Scrapers Disponíveis

### Unified (Futebol + NBA em uma sessão)
- `superbet`, `estrelabet`, `kto`, `sportingbet`, `novibet`, `betnacional`, `stake`

### Football Only
- `betano`, `betbra`, `br4bet`, `mcgames`, `aposta1`, `esportivabet`, `jogodeouro`, `bet365`, `tradeball`

### NBA Only
- `betano_nba`, `betbra_nba`, `br4bet_nba`, `mcgames_nba`, `aposta1_nba`, `esportivabet_nba`, `jogodeouro_nba`

## Vantagens

| Aspecto | Antes (Monolítico) | PM2 (Distribuído) |
|---------|-------------------|-------------------|
| Isolamento de Erros | 1 erro = ciclo falha | 1 erro = apenas 1 bookmaker |
| Velocidade | Playwright bloqueia httpx | 100% paralelo |
| Restart | Manual | Automático em <1s |
| Boot da VPS | Manual | `pm2 startup` |
| Logs | Arquivo único misturado | `pm2 logs scraper-x` |
| Monitoramento | Difícil | `pm2 monit` por scraper |
