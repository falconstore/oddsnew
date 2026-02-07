

# Fix: Impedir mesma casa de aposta no CASA e FORA

## Problema

O `calculate_dg()` seleciona independentemente a melhor odd CASA (PA) e melhor odd FORA (PA), sem verificar se sao da mesma casa de aposta. Quando uma casa (ex: Superbet) tem a melhor odd nos dois lados, o bot envia um DG impossivel de executar.

## Logica da Correcao

Quando CASA e FORA caem na mesma casa, testar duas combinacoes alternativas:

1. **Melhor CASA + segundo melhor FORA** (de outra casa)
2. **Segundo melhor CASA + melhor FORA** (de outra casa)

Escolher a combinacao que gera o melhor ROI. Se nao existir segundo melhor (so tem 1 casa PA), retornar `None`.

## Mudanca no Arquivo

**`docs/scraper/standalone/run_telegram.py`** - funcao `calculate_dg()`, linhas 314-324

### Codigo atual (linhas 314-324)

```python
# Melhor Casa (PA)
pa_with_home = [o for o in pa_odds if o.get('home_odd')]
if not pa_with_home:
    return None
best_home = max(pa_with_home, key=lambda x: x['home_odd'])

# Melhor Fora (PA)
pa_with_away = [o for o in pa_odds if o.get('away_odd')]
if not pa_with_away:
    return None
best_away = max(pa_with_away, key=lambda x: x['away_odd'])
```

### Codigo novo

```python
# Melhor Casa (PA)
pa_with_home = [o for o in pa_odds if o.get('home_odd')]
if not pa_with_home:
    return None
pa_with_home.sort(key=lambda x: x['home_odd'], reverse=True)

# Melhor Fora (PA)
pa_with_away = [o for o in pa_odds if o.get('away_odd')]
if not pa_with_away:
    return None
pa_with_away.sort(key=lambda x: x['away_odd'], reverse=True)

best_home = pa_with_home[0]
best_away = pa_with_away[0]

# Se CASA e FORA cairam na mesma casa, testar alternativas
if best_home['bookmaker_name'] == best_away['bookmaker_name']:
    # Filtrar alternativas de casas diferentes
    alt_home_list = [o for o in pa_with_home if o['bookmaker_name'] != best_away['bookmaker_name']]
    alt_away_list = [o for o in pa_with_away if o['bookmaker_name'] != best_home['bookmaker_name']]
    
    candidates = []
    
    # Opcao 1: melhor CASA original + segundo melhor FORA
    if alt_away_list:
        candidates.append((best_home, alt_away_list[0]))
    
    # Opcao 2: segundo melhor CASA + melhor FORA original
    if alt_home_list:
        candidates.append((alt_home_list[0], best_away))
    
    if not candidates:
        return None  # So tem 1 casa PA, impossivel montar DG
    
    # Escolher a combinacao com maior soma de odds (melhor ROI)
    best_home, best_away = max(candidates, key=lambda c: c[0]['home_odd'] + c[1]['away_odd'])
```

## Comportamento esperado

| Cenario | Resultado |
|---|---|
| Superbet tem melhor CASA e FORA | Testa "Superbet CASA + 2o FORA" vs "2o CASA + Superbet FORA", escolhe o melhor |
| Casas diferentes nos dois lados | Nenhuma mudanca, funciona como antes |
| So 1 casa PA disponivel | Retorna None (DG impossivel) |

## Nenhum outro arquivo afetado

A mudanca e exclusivamente na logica de selecao dentro de `calculate_dg()`. O formato da mensagem, o state tracking e tudo mais permanecem iguais.

## Deploy

```
1. git pull no VPS
2. pm2 restart telegram-dg-bot
3. pm2 logs telegram-dg-bot --lines 20
4. Verificar que CASA e FORA mostram casas diferentes
```
