
# Corrigir Jogo de Ouro e Remover Scrapers NBA Separados

## Problema 1: Jogo de Ouro nao captura token

### Diagnostico

Os logs mostram que cada URL carrega em ~3-4s sem erro, mas nenhuma API call do Altenar e interceptada. A raiz do problema tem duas causas:

1. **URLs sem championship ID**: A Mcgames usa URLs com `/c-2942` no path, o que forca o widget Altenar a carregar imediatamente e fazer API calls. A Jogo de Ouro usa URLs genericas (`/sports/futebol/italia/serie-a`) que nao forcam o carregamento do widget.

2. **3 Playwright simultaneos no triplet**: O triplet atual `("mcgames", "jogodeouro", "esportivabet")` roda 3 browsers Chrome ao mesmo tempo. A Mcgames captura rapido (10s), mas Jogo de Ouro compete com Esportivabet por CPU/RAM.

### Correcao

No arquivo `docs/scraper/scrapers/jogodeouro_unified_scraper.py`:

**a) Adicionar championship ID nas warm-up URLs** (mesmo padrao da Mcgames que funciona):
```python
WARMUP_URLS = [
    "https://jogodeouro.bet.br/sports/futebol/italia/serie-a/c-2942",
    "https://jogodeouro.bet.br/sports/futebol/inglaterra/premier-league/c-2936",
    "https://jogodeouro.bet.br/sports/futebol",
    "https://jogodeouro.bet.br/sports",
]
```

**b) Aumentar tempo de espera** por URL para dar tempo ao widget Altenar:
- Wait inicial: de 2s para 3s
- Wait apos scroll: de 1.5s para 2s
- Wait final: de 5s para 10s

**c) Usar `wait_until="load"`** em vez de `"domcontentloaded"` (espera JS carregar)

---

## Problema 2: Triplet com 3 Playwright

No arquivo `docs/scraper/standalone/run_sequential.py`, reorganizar os triplets para que Jogo de Ouro rode **sozinha** (sem competir por recursos):

```text
Antes:
  Triplet 5: (mcgames, jogodeouro, esportivabet) -- 3 Chrome!
  Triplet 6: (bet365,)
  Triplet 7: (br4bet_nba,)

Depois:
  Triplet 5: (bet365, mcgames, esportivabet)  -- 1 leve + 2 Chrome
  Triplet 6: (jogodeouro,)                     -- 1 Chrome solo
```

Tambem mover `mcgames` e `jogodeouro` de `LIGHT_SCRAPERS` para `HEAVY_SCRAPERS`, pois agora usam Playwright.

---

## Problema 3: Remover br4bet_nba (ja unificado)

O scraper br4bet NBA separado deve ser removido dos seguintes locais:

### Arquivo: `docs/scraper/standalone/run_sequential.py`
- Remover "br4bet_nba" de `LIGHT_SCRAPERS`
- Remover "br4bet_nba" de `ALL_SCRAPERS_INTERLEAVED`
- Remover triplet `("br4bet_nba",)` de `HYBRID_TRIPLETS`
- Remover entrada "br4bet_nba" do `SCRAPER_MAP`

### Arquivo: `docs/scraper/standalone/run_scraper.py`
- Remover entrada "br4bet_nba" do `SCRAPER_MAP`

### Arquivo: `docs/scraper/ecosystem.config.js`
- Remover processo `scraper-br4bet-nba` (linhas 286-299)

---

## Resumo de alteracoes

| Arquivo | O que muda |
|---------|-----------|
| `docs/scraper/scrapers/jogodeouro_unified_scraper.py` | URLs com `/c-XXXX`, wait_until="load", tempos maiores |
| `docs/scraper/standalone/run_sequential.py` | Triplets reorganizados, br4bet_nba removido, mcgames/jogodeouro em HEAVY |
| `docs/scraper/standalone/run_scraper.py` | br4bet_nba removido do SCRAPER_MAP |
| `docs/scraper/ecosystem.config.js` | Processo scraper-br4bet-nba removido |

---

## Deploy

```text
1. git pull no VPS
2. Copiar jogodeouro_unified_scraper.py para jogodeouro_scraper.py no VPS
   (ou renomear, mantendo o conteudo unificado)
3. pm2 stop scraper-br4bet-nba
4. pm2 delete scraper-br4bet-nba
5. pm2 restart scraper-hybrid
6. Verificar logs: pm2 logs scraper-hybrid --lines 30
7. Confirmar: "[JogodeOuro] Token capture successful!" e totais de futebol + NBA
```
