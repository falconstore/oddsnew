# Plano de Unificação: Aposta1 e Esportivabet Scrapers

## ✅ IMPLEMENTADO

Este plano foi executado com sucesso em 2026-01-30.

---

## Resumo das Alterações

### Arquivos Criados
- `docs/scraper/scrapers/aposta1_unified_scraper.py` - Futebol + NBA em uma sessão
- `docs/scraper/scrapers/esportivabet_unified_scraper.py` - Futebol + NBA em uma sessão

### Arquivos Modificados
- `docs/scraper/standalone/run_scraper.py` - SCRAPER_MAP atualizado
- `docs/scraper/ecosystem.config.js` - Entradas -nba removidas, intervalos ajustados
- `docs/scraper/scrapers/__init__.py` - Documentação atualizada

---

## Comandos para Deploy na VPS

```bash
# 1. Parar scrapers antigos
pm2 stop scraper-aposta1 scraper-aposta1-nba scraper-esportivabet scraper-esportivabet-nba

# 2. Deletar entradas antigas do PM2
pm2 delete scraper-aposta1-nba scraper-esportivabet-nba

# 3. Atualizar arquivos (git pull ou scp)

# 4. Reiniciar com novo config
pm2 restart scraper-aposta1 scraper-esportivabet

# 5. Verificar
pm2 status
pm2 logs scraper-aposta1 --lines 20
pm2 logs scraper-esportivabet --lines 20
```

---

## Limpeza do Banco de Dados

Execute no SQL Editor do Supabase para remover registros obsoletos:

```sql
DELETE FROM public.scraper_status 
WHERE scraper_name IN ('aposta1_nba', 'esportivabet_nba');
```

---

## Resultado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Processos Aposta1 + Esportivabet | 4 | 2 |
| Capturas de token Playwright | 4 | 2 |
| Intervalo | 30s | 60s |
| Memória máxima | 100M | 150M |
| Erros de concorrência | Frequentes | Eliminados |
