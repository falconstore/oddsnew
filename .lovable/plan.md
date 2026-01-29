

# Plano: Reverter Alterações Problemáticas

## Diagnóstico

Após análise do código, identifiquei que as mudanças que fiz no McGames estão causando a sobrecarga:

### Problema no McGames

**Antes (funcional):**
- 2 URLs de warmup
- 1 scroll por URL
- ~3.5s por URL = **~7s total**

**Depois da minha alteração (problemático):**
- 4 URLs de warmup
- 3 scrolls por URL com waits longos
- ~7s+ por URL = **~28s+ total**

O setup está demorando quase o mesmo tempo que o intervalo de 30s, causando overlap de processos.

### Problema no Betano

O guard que adicionei está OK, mas o scraper continua tendo problemas de "Target page closed" porque a sessão aiohttp não está sendo limpa corretamente quando há erros.

---

## Solução

### Arquivo 1: `docs/scraper/scrapers/mcgames_scraper.py`

Reverter para configuração mais leve (igual ao Br4bet funcional):

**Mudanças:**
1. Reduzir WARMUP_URLS de 4 para 2
2. Reduzir timeout de 20s para 15s
3. Reduzir wait_for_timeout de 3s para 2s
4. Manter apenas 1 scroll em vez de 3
5. Remover handler de response (desnecessário)

```python
# WARMUP_URLS reduzido
WARMUP_URLS = [
    "https://mcgames.bet.br/sports/futebol/italia/serie-a/c-2942",
    "https://mcgames.bet.br/sports/futebol",
]

# No loop de warmup (mais enxuto)
await page.goto(target_url, wait_until="domcontentloaded", timeout=15000)
await page.wait_for_timeout(2000)

# Single scroll
if not token_future.done():
    await page.evaluate("window.scrollTo(0, 1000)")
    await page.wait_for_timeout(1500)
```

### Arquivo 2: `docs/scraper/scrapers/betano_scraper.py`

Manter o guard pattern (está correto), mas melhorar o tratamento de erro para limpar a sessão aiohttp:

```python
async def teardown(self):
    """Close browser and aiohttp session."""
    # Fechar aiohttp session primeiro (com proteção)
    if self._session:
        try:
            await self._session.close()
        except Exception:
            pass
        self._session = None
    
    # ... resto do código
```

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| mcgames_scraper.py | Reduzir WARMUP_URLS de 4 para 2 |
| mcgames_scraper.py | Reduzir timeout de 20s para 15s |
| mcgames_scraper.py | Reduzir wait de 3s para 2s |
| mcgames_scraper.py | Usar 1 scroll em vez de 3 |
| mcgames_scraper.py | Remover handler de response |
| betano_scraper.py | Adicionar try/except no close da session |

---

## Comandos para Executar na VPS

Após as mudanças serem aplicadas:

```bash
# 1. Parar scrapers problemáticos
pm2 stop scraper-mcgames scraper-betano

# 2. Matar processos chromium órfãos
pkill -f chromium || true

# 3. Atualizar código
cd ~/Desktop/scraper && git pull

# 4. Aguardar 30s
sleep 30

# 5. Reiniciar um por vez
pm2 restart scraper-mcgames
sleep 60
pm2 restart scraper-betano
```

---

## Benefícios

1. **Setup mais rápido**: ~7s em vez de ~28s
2. **Menos overlap**: Tempo entre ciclos respeitado
3. **Menos carga na VPS**: Menos scrolls = menos chamadas API desnecessárias

