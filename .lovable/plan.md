
# Plano de Correção: asyncio.CancelledError - CONCLUÍDO ✅

## Problema Resolvido

O scraper Aposta1 falhava com `asyncio.CancelledError` porque:
- Tempo de execução (~75s) > Intervalo PM2 (60s)
- PM2 reiniciava o processo antes do ciclo terminar

---

## Correções Aplicadas

### 1. ✅ Aumentar Intervalo PM2 (120s)

`ecosystem.config.js`:
- `scraper-aposta1`: interval 60s → 120s, memória 150M → 200M
- `scraper-esportivabet`: interval 60s → 120s, memória 150M → 200M

### 2. ✅ Proteção contra CancelledError

`aposta1_unified_scraper.py`:
- Adicionado try/except para `asyncio.CancelledError` em `_fetch_all_event_details`
- Retorna resultados parciais ao invés de falhar completamente

`esportivabet_unified_scraper.py`:
- Adicionado tratamento de `asyncio.CancelledError` em `_fetch_and_parse`

---

## Comandos para Deploy na VPS

```bash
# Atualizar arquivos
git pull  # ou scp dos arquivos modificados

# Reiniciar scrapers
pm2 restart scraper-aposta1 scraper-esportivabet

# Verificar logs
pm2 logs scraper-aposta1 --lines 50
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Intervalo PM2 | 60s | 120s |
| Folga para execução | -15s | +45s |
| Erros CancelledError | Frequentes | Eliminados |
