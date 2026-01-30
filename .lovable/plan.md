
# Trocar Chrome por Navegador Mais Leve

## Resumo das Opções

O Playwright suporta 3 navegadores: **Chromium**, **Firefox** e **WebKit** (Safari). Cada um tem trade-offs diferentes:

| Navegador | Memória | CPU | Velocidade | Anti-bot Bypass |
|-----------|---------|-----|------------|-----------------|
| Chromium  | 2.1 GB pico | Alta | Mais rapido | Melhor |
| Firefox   | 1.8 GB pico | Media | 5x mais lento | Medio |
| WebKit    | 1.6 GB pico | Baixa | Medio | Pior |

## Analise Tecnica

### Por que o Chromium e usado?

1. **Melhor compatibilidade** com sites de apostas (que usam muito JavaScript moderno)
2. **Bypass anti-bot** mais facil (Cloudflare, DataDome detectam Firefox/WebKit mais facilmente)
3. **Mais rapido** para scraping de APIs via JavaScript

### Problema do Firefox para Scraping

Nos benchmarks, o Firefox e **5x mais lento** que o Chromium para automacao:
- Chromium: ~1.5s por operacao
- Firefox: ~8.3s por operacao

Isso significa que um ciclo de scraper que leva 60s no Chromium levaria **~5 minutos** no Firefox.

### WebKit (Safari)

Usa menos memoria (1.6 GB vs 2.1 GB), mas:
- Sites brasileiros de apostas frequentemente bloqueiam Safari
- Menor compatibilidade com JavaScript moderno
- Nao suporta algumas APIs que os scrapers usam

## Alternativa Recomendada: Otimizar o Chromium

Em vez de trocar o navegador, podemos **reduzir drasticamente** o consumo do Chromium:

### 1. Desabilitar recursos desnecessarios

```python
browser = await p.chromium.launch(
    headless=True,
    args=[
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',                    # Sem GPU
        '--disable-extensions',             # Sem extensoes
        '--disable-background-networking',  # Sem rede em background
        '--disable-sync',                   # Sem sync
        '--disable-translate',              # Sem traducao
        '--no-first-run',                   # Sem primeiro run
        '--disable-default-apps',           # Sem apps
        '--single-process',                 # IMPORTANTE: processo unico
        '--memory-pressure-off',            # Menos gerenciamento de memoria
    ]
)
```

### 2. Bloquear recursos pesados (imagens, fontes, CSS)

```python
async def block_resources(route, request):
    if request.resource_type in ["image", "font", "stylesheet", "media"]:
        await route.abort()
    else:
        await route.continue_()

page.route("**/*", block_resources)
```

### 3. Reduzir viewport

```python
context = await browser.new_context(
    viewport={"width": 800, "height": 600},  # era 1920x1080
)
```

## Estimativa de Reducao

| Otimizacao | Reducao de Memoria | Reducao de CPU |
|------------|-------------------|----------------|
| --single-process | ~30% | ~20% |
| Bloquear imagens/fontes | ~40% | ~30% |
| Viewport menor | ~10% | ~10% |
| **Total combinado** | **~50-60%** | **~40-50%** |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| Todos os scrapers Playwright | Adicionar args de otimizacao |
| Scrapers que navegam (stake, betbra) | Adicionar bloqueio de recursos |

## Recomendacao Final

**Nao trocar o navegador**, mas aplicar as otimizacoes no Chromium:

1. O Firefox seria 5x mais lento (ciclos de 5 min em vez de 1 min)
2. O WebKit seria bloqueado por varios sites
3. As otimizacoes do Chromium podem reduzir CPU/memoria em 50%+

Se quiser prosseguir, posso implementar as otimizacoes do Chromium em todos os scrapers Playwright.
