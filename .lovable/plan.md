

# Ajustar Intervalo da Bet365 para 90s e Melhorar Tratamento de Shutdown

## Problema 1: Intervalo Atual

No `ecosystem.config.js`, a Bet365 está configurada com intervalo de 45 segundos:
```javascript
args: '--scraper bet365 --interval 45',
```

Precisa mudar para **90 segundos** para respeitar os limites da API.

## Problema 2: Erro CancelledError/KeyboardInterrupt

O erro que aparece:
```
asyncio.exceptions.CancelledError
KeyboardInterrupt
```

Isso acontece quando o PM2 envia sinal de shutdown durante o `asyncio.sleep()`. Não é um erro grave - é o comportamento normal quando o PM2 reinicia o processo. Mas podemos melhorar o código para:
1. Tratar o `CancelledError` de forma limpa
2. Mostrar uma mensagem amigável ao invés de traceback

## Implementacao

### 1. Arquivo: `docs/scraper/ecosystem.config.js`

**Linha 232**: Alterar intervalo de 45 para 90 segundos

```javascript
// Antes:
args: '--scraper bet365 --interval 45',

// Depois:
args: '--scraper bet365 --interval 90',
```

### 2. Arquivo: `docs/scraper/standalone/run_scraper.py`

**Funcao `run_forever`**: Adicionar tratamento para `CancelledError`

Envolver o loop principal em try/except para capturar:
- `asyncio.CancelledError` - shutdown gracioso do PM2
- `KeyboardInterrupt` - Ctrl+C manual

Isso evita o traceback feio e mostra apenas uma mensagem de log amigavel.

Mudancas especificas:
1. Importar `asyncio.CancelledError` 
2. No loop `while True`, envolver o `await asyncio.sleep(interval)` em try/except
3. Ao capturar `CancelledError`, fazer break e log de shutdown

### Codigo do tratamento de shutdown (conceito)

```python
while True:
    # ... codigo do ciclo ...
    
    try:
        await asyncio.sleep(interval)
    except asyncio.CancelledError:
        log.info("Received shutdown signal, exiting gracefully...")
        break
```

## Resumo das Mudancas

| Arquivo | Linha | Mudanca |
|---------|-------|---------|
| `ecosystem.config.js` | 232 | Intervalo 45 → 90 |
| `run_scraper.py` | ~195 | Tratar `CancelledError` no sleep |

## Apos Aplicar no VPS

```bash
git pull
pm2 restart scraper-bet365
pm2 logs scraper-bet365 --lines 20
```

O log agora mostrara `Interval: 90s` e nao tera mais traceback de KeyboardInterrupt.

