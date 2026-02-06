

# Corrigir Captura de Token do Jogo de Ouro - Abordagem Diagnostica + Fix

## Analise Comparativa

Comparando os 3 scrapers Altenar lado a lado, encontrei diferencas criticas na configuracao do Playwright:

| Config | Mcgames (funciona) | Esportivabet (funciona) | Jogo de Ouro (FALHA) |
|---|---|---|---|
| Page timeout | 15s | **60s** | 15s |
| Wait apos load | 2s | **3s** | 2s |
| Scrolls | 1x (1000px) | **2x (500 + 1000px)** | 1x (1000px) |
| Wait final | 5s | **10s** | 5s |
| Chrome args | 5 basicos | **11 (com anti-detect)** | 5 basicos |
| Anti-webdriver | Nao | Nao | Nao |
| Debug logging | Nao | Sim (`debug`) | Nao |

O problema: jogodeouro.bet.br provavelmente tem protecao anti-bot mais agressiva que mcgames.bet.br. A pagina carrega (sem erro de navegacao), mas o widget Altenar nao inicializa, ou e bloqueado.

## Solucao: 3 Camadas de Fix

### Camada 1: Diagnostico (entender o que acontece)

Adicionar logging de TODAS as requests interceptadas pelo Playwright, nao apenas `biahosted.com`. Tambem logar o `document.title` e um trecho do HTML apos o carregamento para verificar se a pagina esta renderizando ou se caiu em um Cloudflare challenge.

```python
# Log todas as requests para diagnosticar
async def handle_request(request):
    url = request.url
    # Log qualquer request de API para debug
    if any(x in url for x in ["biahosted.com", "altenar", "widget"]):
        self.logger.info(f"[JogodeOuro] API request detected: {url[:100]}")
        headers = request.headers
        if "authorization" in headers:
            token = headers["authorization"]
            if not token_future.done():
                token_future.set_result(token)
    
# Apos carregar a pagina:
title = await page.evaluate("document.title")
self.logger.info(f"[JogodeOuro] Page title: {title}")
```

### Camada 2: Config agressiva (match Esportivabet)

Aplicar TODAS as configuracoes que fazem a Esportivabet funcionar:

- **Chrome args expandidos**: adicionar `--disable-dev-shm-usage`, `--disable-extensions`, `--disable-background-networking`, `--disable-sync`, `--disable-translate`, `--no-first-run`, `--disable-default-apps`
- **Page timeout**: 15s para **30s**
- **Wait apos load**: 2s para **3s**
- **Scrolls**: 2 scrolls (500px + 1000px) com 2s wait cada
- **Wait final**: 5s para **15s**
- **Mais URLs de warmup**: 4 URLs com championship IDs variados

### Camada 3: Anti-deteccao (injetar stealth JS)

Adicionar `context.add_init_script()` para remover marcadores de automacao que podem estar bloqueando o widget:

```python
await context.add_init_script("""
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
    window.chrome = { runtime: {} };
""")
```

## Arquivo Modificado

**`docs/scraper/scrapers/jogodeouro_scraper.py`** - Apenas o metodo `setup()` e as constantes `CHROME_ARGS` e `WARMUP_URLS`:

### Mudancas especificas:

1. **WARMUP_URLS**: Expandir para 4 URLs com championship IDs diferentes (Serie A, Premier League, generico, raiz)

2. **CHROME_ARGS**: Expandir de 5 para 11 args (match Esportivabet)

3. **setup()**: 
   - Adicionar `context.add_init_script()` com stealth JS
   - Mudar `wait_until` de `"domcontentloaded"` para `"load"` 
   - Aumentar timeout de 15s para 30s
   - Logar `document.title` apos cada pagina carregar
   - Logar TODAS requests que contenham "altenar", "biahosted", ou "widget"
   - Fazer 2 scrolls (500px + 1000px) em vez de 1
   - Aumentar wait final de 5s para 15s

4. **Nenhuma mudanca** nos metodos de parsing ou fetch (esses estao corretos)

## Deploy

```
1. git pull no VPS
2. pm2 restart scraper-jogodeouro (ou scraper-hybrid)
3. pm2 logs scraper-jogodeouro --lines 50
4. Procurar nos logs:
   - "[JogodeOuro] Page title: ..." -> Se diz "Cloudflare" ou esta vazio = site bloqueando
   - "[JogodeOuro] API request detected: ..." -> Se aparece = widget carregou
   - "[JogodeOuro] Token captured" -> Sucesso!
5. Se o titulo da pagina mostrar Cloudflare, precisaremos de outra abordagem
```

Os logs de diagnostico vao nos dizer exatamente por que a captura falha, permitindo uma correcao definitiva.

