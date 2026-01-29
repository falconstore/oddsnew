

# Plano: Resolver Conflito de Processos PM2 no Stake Scraper

## Problema Identificado

O PM2 esta reiniciando o processo enquanto o ciclo anterior ainda esta em execucao:

```text
┌────────────────────────────────────────────────────────────────┐
│                    CONFLITO DE PROCESSOS                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Processo 1 (antigo)        Processo 2 (PM2 restart)           │
│  21:01:43 Sessao...         21:01:51 Starting...               │
│  21:01:49 Browser pronto    21:02:00 Browser...                │
│  21:02:12 Premier League    21:02:15 Sessao...                 │
│  21:02:35 Serie A           21:02:31 Premier League            │
│          ↓                           ↓                         │
│    AMBOS RODANDO AO MESMO TEMPO = CONFLITO                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

O guard `if self._page is not None` funciona dentro do mesmo processo, mas o PM2 cria um processo novo que nao compartilha memoria.

---

## Causa Raiz

O `ecosystem.config.js` do PM2 pode estar configurado com:
- `autorestart: true` sem tempo minimo entre restarts
- `restart_delay` muito baixo
- Nenhum `max_restarts` limitando loops de restart

---

## Solucao em Duas Partes

### Parte 1: Ajustar PM2 (ecosystem.config.js)

Adicionar configuracoes para evitar restarts em loop:

```javascript
{
  name: 'scraper-stake',
  script: 'standalone/run_scraper.py',
  args: '--scraper stake --interval 30',
  interpreter: '/root/Desktop/scraper/venv/bin/python',
  
  // NOVAS CONFIGURACOES
  restart_delay: 10000,      // 10s entre restarts
  max_restarts: 5,           // Max 5 restarts em 15 min
  min_uptime: 30000,         // Processo precisa rodar 30s para ser "estavel"
  kill_timeout: 30000,       // 30s para processo terminar gracefully
  wait_ready: true,          // Aguardar sinal de ready (opcional)
}
```

### Parte 2: Adicionar Signal Handler no run_scraper.py

Tratar SIGTERM/SIGINT gracefully para evitar que o processo seja morto no meio de um ciclo:

```python
import signal

# Global flag para shutdown graceful
shutdown_requested = False

def handle_signal(signum, frame):
    global shutdown_requested
    log.warning(f"Recebido sinal {signum}, aguardando fim do ciclo atual...")
    shutdown_requested = True

async def run_forever(scraper_name, interval, log):
    global shutdown_requested
    
    # Registrar handlers
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    
    # ... setup code ...
    
    while not shutdown_requested:
        # ... ciclo de scraping ...
        
        if shutdown_requested:
            log.info("Shutdown graceful solicitado, saindo...")
            break
        
        await asyncio.sleep(interval)
    
    # Cleanup
    await scraper.teardown()
    log.info("Scraper finalizado gracefully")
```

---

## Mudancas no Arquivo

### Arquivo: `docs/scraper/standalone/run_scraper.py`

#### 1. Adicionar Import e Flag Global

```python
import signal

# Global flag for graceful shutdown
shutdown_requested = False

def request_shutdown(signum, frame):
    """Handle SIGTERM/SIGINT for graceful shutdown."""
    global shutdown_requested
    shutdown_requested = True
```

#### 2. Registrar Signal Handlers em main()

```python
async def main():
    load_dotenv()
    args = parse_args()
    
    log = setup_logging(args.scraper, args.debug)
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)
    
    # ... resto do codigo
```

#### 3. Modificar Loop Principal em run_forever()

```python
async def run_forever(scraper_name, interval, log):
    global shutdown_requested
    
    # ... setup code existente ...
    
    while not shutdown_requested:
        # ... ciclo de scraping ...
        
        # Check shutdown before sleeping
        if shutdown_requested:
            log.info("Shutdown requested, exiting after current cycle...")
            break
        
        await asyncio.sleep(interval)
    
    # Graceful cleanup
    log.info("Performing graceful shutdown...")
    try:
        await scraper.teardown()
    except Exception as e:
        log.warning(f"Error during teardown: {e}")
    
    log.info("Scraper stopped gracefully")
```

---

### Arquivo: `docs/scraper/ecosystem.config.js`

Atualizar configuracao do PM2 para o stake:

```javascript
{
  name: 'scraper-stake',
  script: 'standalone/run_scraper.py',
  args: '--scraper stake --interval 30',
  interpreter: '/root/Desktop/scraper/venv/bin/python',
  cwd: '/root/Desktop/scraper',
  
  // Prevenir restarts em loop
  restart_delay: 10000,        // 10s entre restarts
  max_restarts: 5,             // Max 5 restarts a cada 15 min
  min_uptime: 30000,           // Precisa rodar 30s para ser estavel
  
  // Dar tempo para shutdown graceful
  kill_timeout: 30000,         // 30s para terminar
  
  // Memoria
  max_memory_restart: '400M',  // Aumentado para 10 paginas
}
```

---

## Fluxo Apos Correcoes

```text
┌────────────────────────────────────────────────────────────────┐
│                    FLUXO CORRIGIDO                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. PM2 envia SIGTERM (restart ou stop)                        │
│     └── Handler define shutdown_requested = True               │
│                                                                │
│  2. Loop principal detecta flag                                │
│     └── Nao inicia novo ciclo                                  │
│     └── Aguarda ciclo atual terminar (se em andamento)         │
│                                                                │
│  3. Cleanup graceful                                           │
│     └── Fecha pool de paginas                                  │
│     └── Fecha browser                                          │
│     └── Libera recursos                                        │
│                                                                │
│  4. Processo termina limpo                                     │
│     └── PM2 aguarda 10s (restart_delay)                        │
│     └── Inicia novo processo                                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `run_scraper.py` | Adicionar signal handler para SIGTERM/SIGINT |
| `run_scraper.py` | Usar flag `shutdown_requested` no loop |
| `run_scraper.py` | Fazer teardown graceful antes de sair |
| `ecosystem.config.js` | Adicionar `restart_delay: 10000` |
| `ecosystem.config.js` | Adicionar `kill_timeout: 30000` |
| `ecosystem.config.js` | Aumentar `max_memory_restart` para 400M |

---

## Beneficios

1. **Sem conflito de processos**: Novo processo so inicia apos o antigo terminar
2. **Shutdown graceful**: Browser fecha corretamente, sem erros de "Target closed"
3. **Recursos liberados**: Memoria e processos chromium sao limpos
4. **Logs claros**: Sabe exatamente quando e por que o processo parou

