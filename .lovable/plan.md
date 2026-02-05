

# Plano: Corrigir Bot Telegram - Problemas de Envio e Restart

## Problemas Identificados

| Problema | Causa | Evidência |
|----------|-------|-----------|
| **Bot reinicia a cada 4-5 min** | `watch_delay` ou sinal de cron externo | Logs mostram "Shutting down" regularmente |
| **"2 DGs enviados" mas Telegram falha** | Código salva no banco mesmo com erro 404 | Histórico mostra dados, mas Telegram vazio |
| **Contador mentiroso** | Log conta DGs encontrados, não enviados com sucesso | `count` incrementa antes de verificar envio |

---

## Correções Necessárias

### 1. Só Salvar no Banco se Telegram Enviou com Sucesso

**Arquivo**: `docs/scraper/standalone/run_telegram.py`

```python
# Linha 340-347: Modificar para só salvar se enviou
for match_id, match in matches.items():
    if match_id in enviados:
        continue
    
    dg = self.calculate_dg(match)
    if not dg:
        continue
    
    self.logger.info(f"DG encontrado: {dg['team1']} x {dg['team2']} (ROI: {dg['roi']:.2f}%)")
    
    # Enviar ao Telegram
    msg_id = await self.send_telegram(dg)
    
    # SÓ salva e conta se enviou com sucesso
    if msg_id is not None:
        await self.save_enviado(dg, msg_id)
        dgs_encontrados += 1
        self.logger.info(f"✅ Enviado ao Telegram (msg_id: {msg_id})")
    else:
        self.logger.error(f"❌ Falha ao enviar {dg['team1']} x {dg['team2']}")
    
    await asyncio.sleep(2)
```

### 2. Melhorar Log do Ciclo

```python
# Linha 376-380: Log mais preciso
count = await bot.run_cycle()
if count > 0:
    log.info(f"✅ Ciclo completo: {count} DGs enviados com sucesso")
else:
    log.debug("Ciclo completo: nenhum DG enviado")
```

### 3. Adicionar Handler de Sinal para PM2

O PM2 envia SIGINT para parar o processo. O código atual captura `asyncio.CancelledError` no sleep, mas precisamos também capturar sinais.

```python
import signal

async def main():
    # ... código existente ...
    
    # Handler de sinal
    loop = asyncio.get_running_loop()
    
    def shutdown_handler():
        log.info("Recebido sinal de shutdown")
        for task in asyncio.all_tasks(loop):
            task.cancel()
    
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, shutdown_handler)
    
    # ... resto do código ...
```

### 4. Aumentar Timeout do PM2

**Arquivo**: `docs/scraper/ecosystem.config.js`

```javascript
{
  name: 'telegram-dg-bot',
  script: 'standalone/run_telegram.py',
  interpreter: 'python3',
  args: '--interval 60 --debug',
  cwd: __dirname,
  max_memory_restart: '100M',
  restart_delay: 10000,      // 10s entre restarts
  max_restarts: 50,
  min_uptime: 60000,         // AUMENTAR: 60s para considerar estável
  kill_timeout: 60000,       // AUMENTAR: 60s para aguardar shutdown
  autorestart: true,
  watch: false,              // ADICIONAR: Desabilitar watch (pode causar restarts)
  env: {
    PYTHONUNBUFFERED: '1'
  }
}
```

---

## Diagnóstico do Erro 404

O erro 404 no Telegram indica que o bot token ou channel_id está errado. Precisamos verificar:

```bash
# Na VPS, testar se o token é válido
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Testar se o channel_id está correto
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "$TELEGRAM_CHANNEL_ID", "text": "Teste"}'
```

**Possíveis causas do 404:**
- Token inválido ou expirado
- Bot não foi adicionado ao canal/grupo
- Channel ID em formato errado (deve ser `-100XXXXXXXXXX` para grupos)

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `run_telegram.py` | Só salvar no banco se `msg_id` não for `None` |
| `run_telegram.py` | Corrigir contador para contar apenas envios bem-sucedidos |
| `run_telegram.py` | Adicionar handler de sinal para shutdown gracioso |
| `ecosystem.config.js` | Aumentar `min_uptime` e `kill_timeout` para 60s |
| `ecosystem.config.js` | Adicionar `watch: false` |

---

## Após as Alterações

```bash
# Verificar variáveis de ambiente
pm2 env telegram-dg-bot | grep TELEGRAM

# Se não aparecerem, adicionar ao .env e recarregar
echo "TELEGRAM_BOT_TOKEN=seu_token" >> .env
echo "TELEGRAM_CHANNEL_ID=-100xxxxxxxx" >> .env

# Reiniciar com nova config
pm2 delete telegram-dg-bot
pm2 start ecosystem.config.js --only telegram-dg-bot

# Ver logs
pm2 logs telegram-dg-bot --lines 30
```

