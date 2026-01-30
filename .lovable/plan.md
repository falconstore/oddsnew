
# Plano de Emergência: Resolver Sobrecarga de CPU por Playwright

## Problema Identificado

O `htop` mostra **25+ processos chrome-headless** simultâneos, consumindo toda a CPU. Isso ocorre porque:

1. **5 scrapers Playwright** (betano, betbra, stake, aposta1, esportivabet) rodam ao mesmo tempo
2. **Stake usa pool de 5 páginas**, multiplicando os processos
3. Todos têm intervalo de 120s, então sincronizam e sobrecarregam juntos

## Solução: Escalonamento de Início + Redução do Pool

Implementar duas correções imediatas:

### Correção 1: Adicionar Delay Inicial (Escalonar Scrapers)

Modificar `run_scraper.py` para aceitar `--initial-delay`:

```python
parser.add_argument('--initial-delay', type=int, default=0,
                    help='Segundos para aguardar antes do primeiro ciclo')

async def main():
    # ... existing code ...
    if args.initial_delay > 0:
        log.info(f"Aguardando {args.initial_delay}s antes de iniciar...")
        await asyncio.sleep(args.initial_delay)
    await run_forever(...)
```

### Correção 2: Atualizar ecosystem.config.js com Delays Escalonados

```text
Tempo 0s   -> betano inicia (120s ciclo)
Tempo 25s  -> betbra inicia
Tempo 50s  -> stake inicia  
Tempo 75s  -> aposta1 inicia
Tempo 100s -> esportivabet inicia
Tempo 120s -> betano reinicia (apenas 1 outro rodando)
```

Configuração:

| Scraper       | initial-delay | Resultado                    |
|---------------|---------------|------------------------------|
| betano        | 0             | Inicia imediatamente         |
| betbra        | 25            | +25s do betano               |
| stake         | 50            | +50s do betano               |
| aposta1       | 75            | +75s do betano               |
| esportivabet  | 100           | +100s do betano              |

### Correção 3: Reduzir Pool do Stake (Opcional)

Mudar de 5 para 3 páginas paralelas para reduzir processos renderer:

```python
self._pool_size = 3  # era 5
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `docs/scraper/standalone/run_scraper.py` | Adicionar argumento `--initial-delay` |
| `docs/scraper/ecosystem.config.js` | Adicionar delays escalonados aos scrapers Playwright |
| `docs/scraper/scrapers/stake_scraper.py` | Reduzir pool de 5 para 3 (opcional) |

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Chrome instances simultâneas | 5 | 1-2 |
| Processos renderer simultâneos | ~25 | ~6-8 |
| Pico de CPU | 100%+ | ~40-60% |
| Conflito de ciclos | Alto | Mínimo |

## Comandos para Deploy

```bash
# Na VPS
cd /root/Desktop/scraper  # ou onde estiver o projeto

# Parar tudo
pm2 stop all

# Atualizar arquivos (via git pull ou copia manual)
# ... 

# Reiniciar com nova config
pm2 delete all
pm2 start ecosystem.config.js
pm2 save

# Monitorar
htop
pm2 monit
```

## Seção Técnica: Por que 25 processos Chrome?

Cada instância Chromium headless cria múltiplos processos:
- 1 processo principal (browser)
- 1 processo GPU (mesmo headless)
- 1 processo por page/tab aberta
- Processos adicionais de renderer

Com 5 scrapers rodando simultaneamente:
- Betano: 2-3 processos (1 browser + 1-2 pages)
- Betbra: 2-3 processos
- Stake: 7-8 processos (1 browser + 5 pool pages + renderer)
- Aposta1: 2-3 processos
- Esportivabet: 2-3 processos

Total: ~18-25 processos Chrome competindo por CPU

O escalonamento garante que no máximo 2 scrapers Playwright rodem ao mesmo tempo, reduzindo para ~6-8 processos Chrome.
