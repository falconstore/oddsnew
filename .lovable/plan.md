
# Plano: Corrigir Bot Telegram que Não Está Enviando

## Problemas Identificados

| Problema | Causa | Impacto |
|----------|-------|---------|
| Horário 00:00 | Comparação `06:00 <= now <= 00:00` sempre falsa | Bot retorna "Fora do horário" |
| PM2 matando processo | Falta `min_uptime` e `kill_timeout` | Bot reinicia antes de completar ciclo |
| Sem logs de debug | Args sem `--debug` | Não vemos mensagens de "Fora do horário" |

---

## Solução 1: Corrigir Lógica de Horário

A verificação de horário precisa tratar o caso de cruzar meia-noite (ex: 06:00 até 00:00).

**Arquivo**: `docs/scraper/standalone/run_telegram.py`

```python
def is_within_schedule(self) -> bool:
    """Verifica se está dentro do horário permitido."""
    if not self.config:
        return False
    
    now = datetime.now().time()
    
    # Parse horário (pode vir como HH:MM:SS ou HH:MM)
    inicio_str = self.config['horario_inicio']
    fim_str = self.config['horario_fim']
    
    try:
        if len(inicio_str) == 5:
            inicio_str += ':00'
        if len(fim_str) == 5:
            fim_str += ':00'
        
        inicio = datetime.strptime(inicio_str, '%H:%M:%S').time()
        fim = datetime.strptime(fim_str, '%H:%M:%S').time()
    except ValueError:
        self.logger.error(f"Formato de horário inválido: {inicio_str} / {fim_str}")
        return True  # Em caso de erro, permite execução
    
    # Se fim < inicio, significa que cruza meia-noite (ex: 06:00 até 00:00)
    if fim < inicio:
        # Está no horário se: now >= inicio OU now <= fim
        return now >= inicio or now <= fim
    else:
        # Horário normal: inicio <= now <= fim
        return inicio <= now <= fim
```

---

## Solução 2: Melhorar Config PM2

Adicionar `min_uptime` e `kill_timeout` para evitar reinícios prematuros.

**Arquivo**: `docs/scraper/ecosystem.config.js`

```javascript
{
  name: 'telegram-dg-bot',
  script: 'standalone/run_telegram.py',
  interpreter: 'python3',
  args: '--interval 60 --debug',  // Adicionar --debug
  cwd: __dirname,
  max_memory_restart: '100M',
  restart_delay: 5000,
  max_restarts: 50,
  min_uptime: 30000,      // NOVO: Mínimo 30s para considerar "estável"
  kill_timeout: 30000,    // NOVO: Aguarda 30s antes de matar
  autorestart: true,
  env: {
    PYTHONUNBUFFERED: '1'
  }
}
```

---

## Solução 3: Adicionar Logs de Debug no Ciclo

Para facilitar diagnóstico, logar motivos de não envio.

**Arquivo**: `docs/scraper/standalone/run_telegram.py`

Na função `run_cycle`, adicionar logs mais detalhados:

```python
async def run_cycle(self) -> int:
    """Executa um ciclo de detecção."""
    # Recarregar config
    await self.load_config()
    
    if not self.config:
        self.logger.warning("Config não encontrada")
        return 0
    
    if not self.config.get('enabled'):
        self.logger.debug("Bot desativado na config")
        return 0
    
    if not self.is_within_schedule():
        self.logger.debug(f"Fora do horário ({self.config['horario_inicio']} - {self.config['horario_fim']})")
        return 0
    
    # Buscar dados
    odds = await self.fetch_odds()
    enviados = await self.get_enviados_ids()
    
    self.logger.info(f"Buscando DGs: {len(odds)} odds, {len(enviados)} já enviados hoje")
    
    # ... resto do código
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `run_telegram.py` | Corrigir lógica de horário para cruzar meia-noite |
| `run_telegram.py` | Adicionar logs mais detalhados |
| `ecosystem.config.js` | Adicionar `min_uptime`, `kill_timeout`, `--debug` |

---

## Após as Alterações

Executar na VPS:

```bash
# Reiniciar o bot com nova config
pm2 restart telegram-dg-bot

# Ver logs em tempo real
pm2 logs telegram-dg-bot --lines 50
```

Agora você verá logs como:
- `Buscando DGs: 150 odds, 2 já enviados hoje`
- `DG encontrado: Flamengo x Internacional (ROI: 20.92%)`

Ou mensagens de erro que ajudam a diagnosticar:
- `Fora do horário (06:00 - 00:00)`
- `Bot desativado na config`
