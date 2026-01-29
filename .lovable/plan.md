# Plano: Arquitetura PM2 - IMPLEMENTADO ✅

## Status: CONCLUÍDO

A arquitetura PM2 multi-processo foi implementada com sucesso.

## Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `docs/scraper/standalone/run_scraper.py` | Runner genérico para qualquer scraper |
| `docs/scraper/standalone/run_json_generator.py` | Serviço de geração de JSON |
| `docs/scraper/standalone/run_cleanup.py` | Serviço de limpeza de matches |
| `docs/scraper/standalone/shared_resources.py` | Caches e recursos compartilhados |
| `docs/scraper/standalone/normalizer.py` | Normalização e inserção de odds |
| `docs/scraper/standalone/__init__.py` | Exports do pacote |
| `docs/scraper/standalone/README.md` | Documentação |
| `docs/scraper/ecosystem.config.js` | Configuração PM2 completa |

## Como Usar

```bash
# Na VPS, dentro de docs/scraper:
pm2 start ecosystem.config.js

# Verificar status
pm2 status

# Monitorar em tempo real
pm2 monit

# Auto-start no boot
pm2 startup && pm2 save
```

## Scrapers Configurados

- **HTTPX (30s)**: betano, superbet, novibet, kto, estrelabet, sportingbet, betnacional, stake, br4bet, mcgames, aposta1, esportivabet, jogodeouro, tradeball
- **Playwright (45s)**: bet365, betbra
- **NBA**: betano_nba, betbra_nba, br4bet_nba, mcgames_nba, aposta1_nba, esportivabet_nba, jogodeouro_nba
- **Serviços**: json-generator (15s), cleanup-service (5min)

## Próximos Passos (Opcional)

1. Testar na VPS: `python standalone/run_scraper.py --scraper betano --interval 30 --debug`
2. Iniciar PM2: `pm2 start ecosystem.config.js`
3. Configurar auto-start: `pm2 startup && pm2 save`

