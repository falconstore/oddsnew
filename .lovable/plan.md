

# Correção Urgente - Erros de Memória e Datetime

## Problemas Identificados

| Problema | Causa | Arquivo |
|----------|-------|---------|
| cleanup-service reiniciando infinitamente | `max_memory_restart: '50M'` mas usa ~80MB | ecosystem.sequential.config.js |
| DeprecationWarning datetime | `datetime.utcnow()` deprecated | run_cleanup.py, run_json_generator.py |
| asyncio.CancelledError no shutdown | Não captura graciosamente | run_cleanup.py, run_json_generator.py |

## Correções a Aplicar

### 1. ecosystem.sequential.config.js

Aumentar limite de memória do cleanup-service de 50M para 100M:

```javascript
// Linha 90: ANTES
max_memory_restart: '50M',

// DEPOIS
max_memory_restart: '100M',
```

### 2. run_cleanup.py

Corrigir datetime e shutdown gracioso:

```python
# Linha 16: Adicionar import UTC
from datetime import datetime, timezone

# Linha 98: ANTES
start_time = datetime.utcnow()
# DEPOIS
start_time = datetime.now(timezone.utc)

# Linha 103: ANTES  
duration = (datetime.utcnow() - start_time).total_seconds()
# DEPOIS
duration = (datetime.now(timezone.utc) - start_time).total_seconds()

# Linha 117: Capturar CancelledError no sleep
try:
    await asyncio.sleep(interval)
except asyncio.CancelledError:
    log.info("Shutdown requested during sleep")
    break

# Linha 155-161: Melhorar tratamento de shutdown
try:
    await run_forever(args.interval, log)
except (KeyboardInterrupt, asyncio.CancelledError):
    log.info("Shutting down gracefully...")
except Exception as e:
    log.exception(f"Fatal error: {e}")
    raise
```

### 3. run_json_generator.py

Mesmas correções de datetime e shutdown:

```python
# Linha 18: Já tem timezone importado, OK

# Linha 173: ANTES
start_time = datetime.utcnow()
# DEPOIS
start_time = datetime.now(timezone.utc)

# Linha 192: ANTES
"generated_at": datetime.utcnow().isoformat(),
# DEPOIS
"generated_at": datetime.now(timezone.utc).isoformat(),

# Linha 204: ANTES
duration = (datetime.utcnow() - start_time).total_seconds()
# DEPOIS
duration = (datetime.now(timezone.utc) - start_time).total_seconds()

# Linha 216: Capturar CancelledError no sleep
try:
    await asyncio.sleep(interval)
except asyncio.CancelledError:
    log.info("Shutdown requested during sleep")
    break

# Linha 253-259: Melhorar tratamento de shutdown
try:
    await run_forever(args.interval, log)
except (KeyboardInterrupt, asyncio.CancelledError):
    log.info("Shutting down gracefully...")
except Exception as e:
    log.exception(f"Fatal error: {e}")
    raise
```

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| ecosystem.sequential.config.js | cleanup-service: 50M → 100M |
| run_cleanup.py | datetime.utcnow() → datetime.now(timezone.utc) + shutdown gracioso |
| run_json_generator.py | datetime.utcnow() → datetime.now(timezone.utc) + shutdown gracioso |

## Resultado Esperado

Após as correções:
- Sem mais DeprecationWarning nos logs
- Sem mais restarts infinitos do cleanup-service
- Shutdown limpo sem tracebacks de KeyboardInterrupt/CancelledError

## Comandos para Aplicar na VPS

```bash
# Após atualizar arquivos:
pm2 stop all
pm2 delete all
pm2 start ecosystem.sequential.config.js
pm2 save
pm2 logs
```

