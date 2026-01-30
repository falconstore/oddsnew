

# Corrigir Modo Sequencial - Unificar em 1 Processo

## Problema Identificado

O modo sequencial atual ainda tem carga alta porque:

1. **Dois processos PM2 rodam em paralelo** (`scraper-seq-light` + `scraper-seq-heavy`)
2. **O Stake cria 5+ processos Chrome internamente** (pool de paginas)
3. Resultado: multiplos Chrome + CPU de scrapers leves = load alto

## Solucao

### Camada 1: Unificar em 1 Unico Processo

Mudar de 2 processos para **1 processo que roda TUDO em sequencia**:

```text
ANTES (2 processos paralelos):
  scraper-seq-light  →  [superbet, novibet, kto, ...]     (loop)
  scraper-seq-heavy  →  [betano, betbra, stake, ...]      (loop)
  (ambos rodam ao mesmo tempo!)

DEPOIS (1 processo sequencial):
  scraper-sequential →  [superbet, novibet, ..., betano, betbra, stake, ...]
  (1 scraper por vez, nunca 2 ao mesmo tempo)
```

### Camada 2: Reduzir Pool do Stake

Mudar de 5 para 2 paginas no pool:

| Arquivo | Mudanca |
|---------|---------|
| `docs/scraper/scrapers/stake_scraper.py` | `_pool_size = 5` → `_pool_size = 2` |

Isso reduz de 6 processos Chrome para 3.

### Camada 3: Ordem Otimizada

Intercalar scrapers leves entre os pesados para dar tempo de "respirar":

```text
superbet → novibet → kto → BETANO → estrelabet → sportingbet → BETBRA → 
betnacional → br4bet → STAKE → mcgames → jogodeouro → APOSTA1 → 
tradeball → bet365 → ESPORTIVABET → br4bet_nba → mcgames_nba → jogodeouro_nba
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `ecosystem.sequential.config.js` | Remover `scraper-seq-light`, manter apenas 1 processo `--mode all` |
| `stake_scraper.py` | Reduzir `_pool_size` de 5 para 2 |
| `run_sequential.py` | Mudar ordem para intercalar leves e pesados |

## Nova Config PM2 (apenas 3 processos)

```javascript
module.exports = {
  apps: [
    {
      name: 'scraper-sequential',
      script: 'standalone/run_sequential.py',
      interpreter: 'python3',
      args: '--mode all',  // TUDO em 1 processo
      cwd: __dirname,
      max_memory_restart: '600M',
      restart_delay: 10000,
      max_restarts: 10,
      min_uptime: 60000,
      kill_timeout: 150000,
      autorestart: true,
      env: { PYTHONUNBUFFERED: '1' }
    },
    {
      name: 'json-generator',
      script: 'standalone/run_json_generator.py',
      args: '--interval 60',  // Aumentar para 60s
      // ...
    },
    {
      name: 'cleanup-service',
      // mantido
    }
  ]
};
```

## Nova Ordem no run_sequential.py

```python
# Ordem intercalada: leves + pesados distribuidos
ALL_SCRAPERS_INTERLEAVED = [
    # Bloco 1: 3 leves + 1 pesado
    "superbet", "novibet", "kto", 
    "betano",  # PESADO
    
    # Bloco 2: 3 leves + 1 pesado
    "estrelabet", "sportingbet", "betnacional",
    "betbra",  # PESADO
    
    # Bloco 3: 3 leves + 1 pesado
    "br4bet", "mcgames", "jogodeouro",
    "stake",  # PESADO (com pool reduzido)
    
    # Bloco 4: 2 leves + 1 pesado
    "tradeball", "bet365",
    "aposta1",  # PESADO
    
    # Bloco 5: 3 leves + 1 pesado
    "br4bet_nba", "mcgames_nba", "jogodeouro_nba",
    "esportivabet",  # PESADO
]
```

## Estimativa de Carga

| Aspecto | Antes (2 processos) | Depois (1 processo) |
|---------|---------------------|---------------------|
| Processos PM2 | 4 | 3 |
| Chrome maximo simultaneo | 6+ (Stake pool) | 3 (Stake reduzido) |
| Load estimado | 11-19 | 2-4 |
| Ciclo completo | ~3-5 min | ~8-10 min |

## Passos de Implementacao

1. Modificar `ecosystem.sequential.config.js` para usar `--mode all`
2. Modificar `run_sequential.py` para ordem intercalada
3. Modificar `stake_scraper.py` para `_pool_size = 2`
4. Na VPS: parar PM2, copiar arquivos, reiniciar
5. Monitorar `htop` - load deve ficar entre 2-4

## Rollback

Se ainda nao funcionar, voltar ao modo paralelo original:

```bash
pm2 stop all && pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

