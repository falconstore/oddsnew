
# ✅ IMPLEMENTADO: Escalonamento de Scrapers Playwright

## Problema Resolvido

**25+ processos chrome-headless simultâneos** causando 100% CPU.

## Solução Aplicada

### 1. Argumento `--initial-delay` no runner
Adicionado em `docs/scraper/standalone/run_scraper.py`:
- Aguarda N segundos antes do primeiro ciclo
- Escalonamento controlado via PM2

### 2. Delays Escalonados no ecosystem.config.js

| Scraper       | Delay | Tempo de Início |
|---------------|-------|-----------------|
| betano        | 0s    | Imediato        |
| betbra        | 25s   | +25s            |
| stake         | 50s   | +50s            |
| aposta1       | 75s   | +75s            |
| esportivabet  | 100s  | +100s           |

## Deploy na VPS

```bash
# Atualizar arquivos
cd /root/Desktop/scraper
# (copiar run_scraper.py e ecosystem.config.js atualizados)

# Reiniciar PM2
pm2 stop all
pm2 delete all
pm2 start ecosystem.config.js
pm2 save

# Monitorar
htop
pm2 monit
```

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Chrome simultâneos | 5 | 1-2 |
| Processos renderer | ~25 | ~6-8 |
| Pico de CPU | 100%+ | ~40-60% |
