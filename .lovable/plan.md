

# Corrigir Caminhos de Importacao dos Scrapers Mcgames e Jogo de Ouro

## Problema

Os runners tentam importar de modulos que nao existem no VPS:

```
scrapers.mcgames_unified_scraper  -->  arquivo real: scrapers.mcgames_scraper
scrapers.jogodeouro_unified_scraper  -->  arquivo real: scrapers.jogodeouro_scraper
```

## Correcao

Atualizar o `SCRAPER_MAP` em dois arquivos para apontar para os nomes corretos dos modulos:

### Arquivo 1: `docs/scraper/standalone/run_sequential.py` (linhas 170-171)

Mudar:
- `scrapers.mcgames_unified_scraper` para `scrapers.mcgames_scraper`
- `scrapers.jogodeouro_unified_scraper` para `scrapers.jogodeouro_scraper`

### Arquivo 2: `docs/scraper/standalone/run_scraper.py` (linhas 90-91)

Mesma correcao:
- `scrapers.mcgames_unified_scraper` para `scrapers.mcgames_scraper`
- `scrapers.jogodeouro_unified_scraper` para `scrapers.jogodeouro_scraper`

Os nomes das classes (`McgamesUnifiedScraper` e `JogodeOuroUnifiedScraper`) permanecem iguais, pois e o conteudo que esta dentro dos arquivos.

## Resultado

Apos o deploy:
- `pm2 logs scraper-hybrid --lines 10` deve mostrar "mcgames: X -> Y em Zs" sem erros de importacao

