
# Correcao Urgente: Erro de Indentacao no mcgames_scraper.py

## Problema Identificado

O arquivo `docs/scraper/scrapers/mcgames_scraper.py` tem um **erro de sintaxe** na linha 29:

```python
# ERRADO (5 espacos - 1 espaco extra)
     LEAGUES = {

# CORRETO (4 espacos - indentacao padrao)
    LEAGUES = {
```

## Por Que Isso Quebra TODOS os Scrapers

Quando qualquer scraper inicia (mesmo betano, superbet, etc), o codigo faz:

```text
run_scraper.py 
  -> get_scraper_class() 
    -> from scrapers import ... 
      -> scrapers/__init__.py 
        -> from .mcgames_scraper import McgamesScraper 
          -> ERRO DE SINTAXE!
```

Como o `__init__.py` importa TODOS os scrapers, um erro em qualquer um deles impede a importacao de TODOS.

## Correcao

### Arquivo: docs/scraper/scrapers/mcgames_scraper.py

Linha 29 - Remover o espaco extra:

```python
# Antes (linha 29):
     LEAGUES = {

# Depois (linha 29):
    LEAGUES = {
```

## Apos a Correcao

Na VPS, execute:
```bash
# Atualizar codigo (git pull ou copiar arquivo)
git pull

# Reiniciar todos os scrapers
pm2 restart all

# Verificar status
pm2 status

# Monitorar
pm2 monit
```

Todos os scrapers devem voltar a funcionar imediatamente.

## Resumo

| Item | Detalhe |
|------|---------|
| Arquivo | `docs/scraper/scrapers/mcgames_scraper.py` |
| Linha | 29 |
| Problema | 1 espaco extra na indentacao |
| Impacto | TODOS os scrapers quebrados |
| Correcao | Remover o espaco extra |
