
# Modo Triplet - 3 Scrapers em Paralelo

## Situação Atual

| Métrica | Valor Atual | Capacidade |
|---------|-------------|------------|
| CPU | 13% | 100% |
| Memória | 10% (~3GB) | 32GB |
| Load Average | ~1.0 | 8.0 (8 cores) |
| Ciclo | ~183s | - |

Você está usando apenas **~12% da capacidade** do servidor. Há margem confortável para triplicar o paralelismo.

## Proposta: Triplets (2 Leves + 1 Pesado)

Agrupar scrapers em **triplets** que executam simultaneamente:

```text
Triplet 1: superbet + novibet + betano        (2 HTTPX + 1 Playwright)
Triplet 2: kto + estrelabet + betbra          (2 HTTPX + 1 Playwright)  
Triplet 3: sportingbet + betnacional + stake  (2 HTTPX + 1 Playwright)
Triplet 4: br4bet + mcgames + aposta1         (2 HTTPX + 1 Playwright)
Triplet 5: jogodeouro + tradeball + esportivabet (2 HTTPX + 1 Playwright)
Triplet 6: bet365 (solo)                      (API externa com rate limit)
Triplet 7: br4bet_nba + mcgames_nba + jogodeouro_nba (3 HTTPX)
```

## Estimativa de Performance

| Modo | Scrapers Paralelos | Tempo Ciclo | Load Esperado |
|------|-------------------|-------------|---------------|
| Sequencial | 1 | ~229s | 1.5 |
| Híbrido atual | 2 | ~183s | 3-5 |
| **Triplet** | **3** | **~120-140s** | **4-6** |

**Redução adicional de ~25-35%** no tempo de ciclo!

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `run_sequential.py` | Substituir `HYBRID_PAIRS` por `HYBRID_TRIPLETS` |
| `ecosystem.sequential.config.js` | Aumentar `max_memory_restart` para 800M (3 scrapers simultâneos) |

## Implementação Detalhada

### 1. Nova estrutura HYBRID_TRIPLETS em run_sequential.py

```python
# Triplets otimizados: 2 leves + 1 pesado quando possível
HYBRID_TRIPLETS = [
    # (leve, leve, pesado) - rodam em paralelo
    ("superbet", "novibet", "betano"),
    ("kto", "estrelabet", "betbra"),
    ("sportingbet", "betnacional", "stake"),
    ("br4bet", "mcgames", "aposta1"),
    ("jogodeouro", "tradeball", "esportivabet"),
    
    # API externa (solo para respeitar rate limit)
    ("bet365",),
    
    # NBA (todos leves, podem rodar juntos)
    ("br4bet_nba", "mcgames_nba", "jogodeouro_nba"),
]
```

### 2. Renomear HYBRID_PAIRS para HYBRID_TRIPLETS

A função `run_hybrid()` já suporta tuplas de qualquer tamanho, então só precisa trocar a constante.

### 3. Atualizar get_scrapers_for_mode()

```python
elif mode == "hybrid":
    return HYBRID_TRIPLETS  # Antes era HYBRID_PAIRS
```

### 4. Ajustar ecosystem.sequential.config.js

```javascript
{
  name: 'scraper-hybrid',
  // ...
  max_memory_restart: '800M',  // Antes: 700M (para 3 scrapers)
}
```

## Comparação Visual

```text
ANTES (Híbrido - Pares):
  Par 1: [superbet] + [betano]     → 60s
  Par 2: [novibet]  + [betbra]     → 55s
  Par 3: [kto]      + [stake]      → 50s
  ...
  Total: ~183s

DEPOIS (Triplets):
  Triplet 1: [superbet + novibet] + [betano]     → 60s
  Triplet 2: [kto + estrelabet]   + [betbra]     → 55s
  Triplet 3: [sportingbet + betnacional] + [stake] → 50s
  ...
  Total: ~120-140s
```

## Segurança

- Load esperado: 4-6 (ainda abaixo do limite de 8 cores)
- Se o load ultrapassar 6 consistentemente, basta voltar para `HYBRID_PAIRS`
- O cooldown de 2s entre triplets pesados continua ativo

## Rollback Rápido

Se precisar voltar ao modo de pares:

```python
# Em run_sequential.py, linha ~481:
elif mode == "hybrid":
    return HYBRID_PAIRS  # Volta para pares
```

## Resumo das Mudanças

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| run_sequential.py | ~93-109 | Substituir `HYBRID_PAIRS` por `HYBRID_TRIPLETS` |
| run_sequential.py | ~481 | Retornar `HYBRID_TRIPLETS` no modo hybrid |
| ecosystem.sequential.config.js | ~28 | `max_memory_restart: '800M'` |

## Comandos para Ativar

```bash
# Na VPS:
pm2 stop all && pm2 delete all
pm2 start ecosystem.sequential.config.js
pm2 save
pm2 logs scraper-hybrid
htop  # Monitorar load
```

## Resultado Esperado

- Ciclo: **~120-140s** (vs ~183s atual)
- Load: **4-6** (seguro para 8 cores)
- Freshness: dados atualizados a cada **~2 minutos**
