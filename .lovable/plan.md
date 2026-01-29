
# Plano de Emergência: Estabilizar VPS

## Diagnóstico

A imagem mostra uma situação crítica:
- **8 scrapers em "waiting restart"** com 0 MB (crashando em loop)
- **5 scrapers com CPU 25-31%** (possíveis processos travados)
- Total: ~750 MB de memória e CPU muito alta

### Causa Raiz
Os scrapers Playwright (Stake, Betano, McGames) estão entrando em ciclos de crash/restart que:
1. Iniciam um browser Chromium (~50-100MB cada)
2. Crasham antes de completar o ciclo
3. PM2 reinicia imediatamente
4. Repete infinitamente, consumindo recursos

---

## Solução Imediata (3 Partes)

### Parte 1: Aumentar restart_delay para TODOS os scrapers problemáticos

Aumentar o tempo entre restarts para **30 segundos** em vez de 3-10s. Isso dá tempo para recursos serem liberados.

**Arquivo: `docs/scraper/ecosystem.config.js`**

Scrapers que precisam de ajuste:
- scraper-betano: `restart_delay: 30000`
- scraper-stake: `restart_delay: 30000`
- scraper-mcgames: `restart_delay: 30000`
- scraper-bet365: `restart_delay: 30000`
- scraper-betbra: `restart_delay: 30000`
- Todos os scrapers NBA: `restart_delay: 30000`

### Parte 2: Adicionar exp_backoff_restart_delay

PM2 suporta backoff exponencial - se o processo crashar várias vezes seguidas, o delay aumenta automaticamente.

```javascript
{
  name: "scraper-stake",
  // ...
  exp_backoff_restart_delay: 1000,  // Começa em 1s, dobra a cada crash (até 15min)
  restart_delay: 30000,             // Delay mínimo
  max_restarts: 3,                  // Máximo 3 restarts por janela de tempo
  min_uptime: 60000,                // Precisa rodar 60s para resetar contador
}
```

### Parte 3: Reduzir pool de páginas do Stake

O pool de 10 páginas está consumindo muita memória. Reduzir para 5.

**Arquivo: `docs/scraper/scrapers/stake_scraper.py`**

```python
def __init__(self):
    # ...
    self._pool_size = 5  # Reduzido de 10 para 5
```

---

## Mudanças nos Arquivos

### 1. `docs/scraper/ecosystem.config.js`

Aplicar configurações de estabilidade para TODOS os scrapers:

```javascript
// Configuração padrão para scrapers HTTPX (leves)
{
  restart_delay: 10000,
  max_restarts: 10,
  min_uptime: 30000,
  exp_backoff_restart_delay: 1000,
}

// Configuração para scrapers Playwright (pesados)
{
  restart_delay: 30000,
  max_restarts: 3,
  min_uptime: 60000,
  kill_timeout: 30000,
  exp_backoff_restart_delay: 2000,
}
```

Scrapers que usam Playwright:
- scraper-betano
- scraper-stake
- scraper-mcgames
- scraper-bet365
- scraper-betbra
- scraper-betano-nba
- scraper-betbra-nba

### 2. `docs/scraper/scrapers/stake_scraper.py`

Reduzir pool de páginas:

```python
self._pool_size = 5  # Reduzido de 10 para 5 (linha 64)
```

---

## Ação Imediata na VPS (Executar Manualmente)

Antes de aplicar as mudanças no código, execute na VPS:

```bash
# 1. Parar TODOS os scrapers problemáticos
pm2 stop scraper-stake scraper-betano scraper-mcgames scraper-bet365 scraper-betbra

# 2. Parar scrapers NBA também
pm2 stop scraper-betano-nba scraper-betbra-nba scraper-mcgames-nba

# 3. Verificar se processos chromium órfãos existem
pkill -f chromium || true

# 4. Aguardar 30s para memória ser liberada
sleep 30

# 5. Verificar uso de memória
free -m

# 6. Reiniciar apenas scrapers HTTPX primeiro
pm2 restart scraper-superbet scraper-novibet scraper-kto scraper-estrelabet

# 7. Se memória estiver OK, reiniciar Playwright um por vez
pm2 restart scraper-stake
# Aguardar 1 minuto e verificar se estabilizou
pm2 restart scraper-betano
# Aguardar 1 minuto e verificar
```

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| ecosystem.config.js | restart_delay: 30s para scrapers Playwright |
| ecosystem.config.js | exp_backoff_restart_delay: 2000 para todos |
| ecosystem.config.js | max_restarts: 3 para scrapers Playwright |
| ecosystem.config.js | min_uptime: 60s para scrapers Playwright |
| stake_scraper.py | Pool reduzido de 10 para 5 páginas |

---

## Benefícios

1. **Menos restarts em loop**: Delay de 30s + backoff exponencial
2. **Menos memória**: Pool de 5 páginas em vez de 10
3. **Recuperação automática**: PM2 para de reiniciar após 3 falhas
4. **Limpeza de recursos**: kill_timeout de 30s garante cleanup
