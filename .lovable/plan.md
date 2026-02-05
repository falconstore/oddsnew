
# Plano: Corrigir Cálculo de DG (ROI e Stakes)

## Problema Identificado

| Campo | Valor Atual (Errado) | Valor Correto (Calculadora) |
|-------|---------------------|----------------------------|
| Stake Empate | R$ 121.43 | R$ 147.96 |
| Investimento | R$ 603.57 | R$ 751.53 |
| ROI | +14.23% | -3.53% |

## Lógica Correta (Baseada na Calculadora)

A estratégia Duplo Green equaliza o retorno em todos os cenários:

```text
Dados: odd_casa=1.45, odd_empate=4.90, odd_fora=7.00, stake_base=500

1. stake_casa = stake_base = 500
2. stake_fora = stake_base * odd_casa / odd_fora = 500 * 1.45 / 7.00 = 103.57
3. retorno_green = stake_casa * odd_casa = 500 * 1.45 = 725.00
   (também: stake_fora * odd_fora = 103.57 * 7.00 = 725.00) ✓
4. stake_empate = retorno_green / odd_empate = 725.00 / 4.90 = 147.96
5. investimento = stake_casa + stake_fora + stake_empate = 500 + 103.57 + 147.96 = 751.53
6. lucro = retorno_green - investimento = 725.00 - 751.53 = -26.53
7. roi = (lucro / investimento) * 100 = (-26.53 / 751.53) * 100 = -3.53%
```

---

## Alterações no Código

### Arquivo: `docs/scraper/standalone/run_telegram.py`

#### 1. Corrigir cálculo de stakes (linhas 180-202)

```python
# Calcular stakes com lógica correta
stake_base = float(self.config['stake_base'])
stake_casa = stake_base

# Stake fora proporcional para equalizar retorno
stake_fora = stake_base * (home_odd / away_odd)

# Retorno garantido (igual em Casa e Fora)
retorno_green = stake_casa * home_odd  # = stake_fora * away_odd

# Stake empate para equalizar retorno do empate
stake_empate = retorno_green / draw_odd

# Investimento TOTAL inclui os 3 resultados
total_stake = stake_casa + stake_fora + stake_empate

# Lucro = retorno - investimento
lucro = retorno_green - total_stake

# ROI baseado no investimento total
roi = (lucro / total_stake) * 100
```

#### 2. Atualizar campo `total_stake` no dicionário (linha 222)

```python
return {
    # ... outros campos ...
    'total_stake': total_stake,  # Agora inclui stake_empate
    'retorno_green': retorno_green,
    'lucro': lucro,
}
```

#### 3. Atualizar mensagem Telegram (linhas 244-252)

```python
⚖️ <b>EMPATE (SO):</b> {dg['empate']['bookmaker']}
   └ ODD: {dg['empate']['odd']:.2f} | Stake: R$ {dg['empate']['stake']:.2f}

# Investimento já inclui os 3 stakes
💰 <b>Investimento:</b> R$ {dg['total_stake']:.2f}
📊 <b>ROI:</b> {roi_sign}{dg['roi']:.2f}%
✅ <b>Retorno possível duplo Green:</b> R$ {dg['retorno_green']:.2f}
```

---

## Verificação com Números Reais

```text
Ajax x Fortuna Sittard (calculadora):
- odd_casa=1.45, odd_empate=4.90, odd_fora=7.00, base=500

Cálculo:
- stake_casa = 500.00
- stake_fora = 500 * 1.45 / 7.00 = 103.57
- retorno_green = 500 * 1.45 = 725.00
- stake_empate = 725.00 / 4.90 = 147.96
- investimento = 500 + 103.57 + 147.96 = 751.53
- lucro = 725.00 - 751.53 = -26.53
- roi = -26.53 / 751.53 * 100 = -3.53% ✓
```

---

## Resumo das Mudanças

| Local | Antes | Depois |
|-------|-------|--------|
| stake_empate | `risco / (odd - 1)` | `retorno_green / odd_empate` |
| total_stake | `casa + fora` | `casa + fora + empate` |
| retorno_green | média dos cenários | `stake_casa * odd_casa` |
| Mensagem Empate | "Risco" | "Stake" |

---

## Resultado Esperado

Mensagem corrigida:
```text
🦈 DUPLO GREEN ENCONTRADO 🦈

⚽ AFC Ajax x Fortuna Sittard
🏆 Eredivisie
📅 2026-02-14

🏠 CASA (PA): Novibet
   └ ODD: 1.45 | Stake: R$ 500.00

⚖️ EMPATE (SO): stake
   └ ODD: 4.90 | Stake: R$ 147.96

🚀 FORA (PA): esportivabet
   └ ODD: 7.00 | Stake: R$ 103.57

💰 Investimento: R$ 751.53
📊 ROI: -3.53%
✅ Retorno possível duplo Green: R$ 725.00

🦈 #BetSharkPro #DuploGreen
```
