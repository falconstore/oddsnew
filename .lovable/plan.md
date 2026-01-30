# Modo Híbrido - IMPLEMENTADO ✅

## Resultado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Modo | Sequencial | Híbrido |
| Tempo estimado | ~229s | ~120-150s |
| Load esperado | 1.5 | 3-5 |

## Arquivos Modificados

- `docs/scraper/standalone/run_sequential.py` - Adicionado `HYBRID_PAIRS`, `run_hybrid()`, atualizado CLI
- `docs/scraper/ecosystem.sequential.config.js` - Alterado para usar `--mode hybrid` por padrão

## Comandos para Ativar

```bash
pm2 stop all && pm2 delete all
pm2 start ecosystem.sequential.config.js
pm2 save
pm2 logs scraper-hybrid
```

## Rollback para Sequencial

Se load ficar >6, edite o ecosystem e troque para modo sequencial:
```javascript
args: '--mode all'  // Em vez de '--mode hybrid'
```

