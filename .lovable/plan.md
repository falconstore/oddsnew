

# Corrigir Memory Restart Loop no PM2

## Problema

O PM2 esta reiniciando **8 processos em loop continuo** porque o `max_memory_restart` esta configurado abaixo do consumo real de memoria. Isso causa:

- Perda de ciclos de scraping (cada restart leva ~5-10s para reinicializar shared_resources)
- Cascade de restarts simultaneos sobrecarregando a VPS
- Mensagens "failed to kill - retrying in 100ms" quando o PM2 nao consegue matar processos rapido o suficiente
- O cleanup-service e json-generator nunca completam um ciclo inteiro

## Causa Raiz

Os scrapers HTTPX carregam o `shared_resources` (294 teams, 835 aliases, 19 leagues) na inicializacao, que consome ~80-90MB de base. Com o overhead do Python + httpx, o consumo real fica entre 100-115MB. O limite de 100MB e essencialmente igual ao consumo base, causando restarts constantes.

## Solucao

Aumentar os limites de memoria no `docs/scraper/ecosystem.config.js` para refletir o consumo real com margem de seguranca:

### Mudancas no ecosystem.config.js

**HTTPX Scrapers (7 processos)**: `100M` para `150M`
- scraper-superbet
- scraper-novibet
- scraper-kto
- scraper-estrelabet
- scraper-sportingbet
- scraper-betnacional
- scraper-br4bet

**Tradeball**: `100M` para `150M`

**json-generator**: `100M` para `200M`
(Conforme nota de arquitetura existente: precisa de pelo menos 150M para processar o odds.json de ~1.1MB)

**cleanup-service**: `50M` para `150M`
(Consumo real de 84MB, com margem para picos)

**alias-generator**: `100M` para `150M`
(Mesmo padrao dos outros servicos leves)

### Resumo dos novos limites

| Tipo | Processos | Limite anterior | Novo limite |
|---|---|---|---|
| Playwright pesado | betano, betbra | 300M | 300M (sem mudanca) |
| Playwright pesado | stake | 400M | 400M (sem mudanca) |
| Playwright medio | mcgames, aposta1, esportivabet, jogodeouro | 200M | 200M (sem mudanca) |
| HTTPX scraper | superbet, novibet, kto, estrelabet, sportingbet, betnacional, br4bet, tradeball | 100M | 150M |
| API scraper | bet365 | 200M | 200M (sem mudanca) |
| Servico auxiliar | json-generator | 100M | 200M |
| Servico auxiliar | cleanup-service | 50M | 150M |
| Servico auxiliar | alias-generator | 100M | 150M |
| Telegram bot | telegram-dg-bot | 150M | 150M (sem mudanca) |

### Impacto na VPS

- Aumento maximo teorico: ~550MB (se todos atingirem o novo limite)
- Na pratica: consumo real fica ~100-115MB por HTTPX scraper, entao o aumento real e zero
- Beneficio: elimina completamente o restart loop e as mensagens "failed to kill"

## Deploy

```
1. git pull no VPS
2. pm2 delete all
3. pm2 start ecosystem.config.js
4. pm2 save
5. pm2 monit (verificar que nenhum processo esta em restart loop)
```

Apos aplicar, os logs devem mostrar ciclos completos sem interrupcoes.

