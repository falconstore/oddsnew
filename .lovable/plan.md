
# Plano: Corrigir Cálculo do Lucro Duplo Green

## Entendendo a Fórmula Desejada

O usuário quer mostrar o lucro considerando que você ganha nos **dois cenários** (Casa E Fora):

```text
Fórmula: (stake_casa × odd_casa × 2) - investimento

Exemplo:
- stake_casa = 500
- odd_casa = 2.86
- investimento = 1444.53

Cálculo:
- retorno_casa = 500 × 2.86 = 1430
- retorno_duplo = 1430 × 2 = 2860
- lucro_duplo_green = 2860 - 1444.53 = 1415.47
```

---

## Alteração no Código

### Arquivo: `docs/scraper/standalone/run_telegram.py`

**Linha ~339** - Modificar cálculo do `lucro`:

```python
# ANTES (lucro simples):
lucro = retorno_green - total_stake

# DEPOIS (lucro duplo - 2x retorno):
lucro_duplo_green = (retorno_green * 2) - total_stake
```

**Atualizar retorno do dicionário (~linha 375)**:

```python
return {
    # ... outros campos ...
    'lucro': lucro_duplo_green,  # Agora é (retorno × 2) - investimento
    'retorno_green': retorno_green,  # Manter para referência
}
```

**Manter ROI como está** (baseado no investimento real):

```python
# ROI continua baseado no lucro simples para comparação
roi = ((retorno_green - total_stake) / total_stake) * 100
```

---

## Verificação com Números Reais

```text
FC Metz x AJ Auxerre:
- odd_casa = 2.86, stake_casa = 500
- investimento = 1444.53

Cálculo:
- retorno_casa = 500 × 2.86 = 1430.00
- retorno_duplo = 1430.00 × 2 = 2860.00
- lucro_duplo_green = 2860.00 - 1444.53 = 1415.47 ✓
```

---

## Resultado Esperado

### Mensagem Atualizada:
```text
🦈 DUPLO GREEN ENCONTRADO 🦈

⚽ FC Metz x AJ Auxerre
🏆 Ligue 1
📅 15/02/2026 às 16:15

🏠 CASA (PA): Estrelabet
   └ ODD: 2.86 | Stake: R$ 500.00

⚖️ EMPATE (SO): kto
   └ ODD: 3.05 | Stake: R$ 468.36

🚀 FORA (PA): Estrelabet
   └ ODD: 3.00 | Stake: R$ 476.17

💰 Investimento: R$ 1444.53
📊 ROI: -1.11%
✅ Lucro Duplo Green: R$ 1415.47   ← CORRIGIDO

🦈 #BetSharkPro #DuploGreen
```

---

## Resumo

| Campo | Antes | Depois |
|-------|-------|--------|
| Lucro Duplo Green | retorno - investimento | (retorno × 2) - investimento |
| Exemplo | -R$ 16.03 | R$ 1415.47 |
