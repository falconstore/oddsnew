

# Plano: Melhorar Formato da Mensagem Telegram DG

## Mudanças Solicitadas

| Item | Atual | Novo |
|------|-------|------|
| Título | `DG ENCONTRADO` | `DUPLO GREEN ENCONTRADO` (negrito) |
| Data/Hora | `2026-02-04 às 22:00` (com fuso) | `2026-02-04` (sem horário/fuso) |
| Stake Casa | Calculado por arbitragem | Usar valor direto da stake_base |
| Stake Fora | Calculado por arbitragem | Proporcional ao investimento |
| Investimento | Soma de Casa+Fora | Soma de Casa+Fora+Empate |
| Retorno | `Retorno Green` | `Retorno possível duplo Green` com fórmula média |

---

## Lógica de Cálculo Corrigida

A fórmula atual calcula stakes para arbitragem perfeita. Você quer uma abordagem diferente:

```text
Novo Cálculo:
- stake_casa = stake_base (configurado, ex: R$ 500)
- stake_fora = stake_base / odd_fora * odd_casa (proporcional)
- stake_empate = risco / (odd_empate - 1)
- investimento = stake_casa + stake_fora + stake_empate
- retorno_green = (stake_casa * odd_casa + stake_fora * odd_fora) / 2
```

---

## Novo Formato da Mensagem

```text
🦈 DUPLO GREEN ENCONTRADO 🦈

⚽ Flamengo x Internacional
🏆 Brasileirão Série A
📅 2026-02-04

🏠 CASA (PA): sportingbet
   └ ODD: 1.57 | Stake: R$ 500.00

⚖️ EMPATE (SO): betnacional
   └ ODD: 3.65 | Risco: R$ 215.00

🚀 FORA (PA): sportingbet
   └ ODD: 6.50 | Stake: R$ 121.00

💰 Investimento: R$ 836.00
📊 ROI: -6.13%
✅ Retorno possível duplo Green: R$ 1570.00

🦈 #BetSharkPro #DuploGreen
```

---

## Alterações no Código

### Arquivo: `docs/scraper/standalone/run_telegram.py`

#### 1. Título da mensagem (linha 221)

```python
# De:
message = f"""🦈 <b>DG ENCONTRADO</b> 🦈

# Para:
message = f"""🦈 <b>DUPLO GREEN ENCONTRADO</b> 🦈
```

#### 2. Remover horário da data (linha 225)

```python
# De:
📅 {dg['match_date']} às {dg['kickoff']}

# Para:
📅 {dg['match_date']}
```

#### 3. Novo cálculo de stakes (função calculate_dg, linhas 180-211)

```python
# Calcular stakes com nova lógica
stake_base = float(self.config['stake_base'])
stake_casa = stake_base

# Stake fora proporcional
stake_fora = stake_base * (home_odd / away_odd)

# Retorno se ganhar Casa ou Fora
retorno_casa = stake_casa * home_odd
retorno_fora = stake_fora * away_odd

# Retorno médio (média dos dois cenários de green)
retorno_green = (retorno_casa + retorno_fora) / 2

# Risco no empate = investimento casa+fora - retorno
risco_empate = (stake_casa + stake_fora) - retorno_green
stake_empate = abs(risco_empate) / (draw_odd - 1) if draw_odd > 1 else 0

# Investimento total inclui empate
total_stake = stake_casa + stake_fora + stake_empate

# ROI baseado no investimento total
roi = ((retorno_green - total_stake) / total_stake) * 100
```

#### 4. Atualizar texto do retorno (linha 238)

```python
# De:
✅ <b>Retorno Green:</b> R$ {dg['retorno_green']:.2f}

# Para:
✅ <b>Retorno possível duplo Green:</b> R$ {dg['retorno_green']:.2f}
```

---

## Resumo das Mudanças

| Arquivo | Linha(s) | Alteração |
|---------|----------|-----------|
| `run_telegram.py` | 221 | Título: `DUPLO GREEN ENCONTRADO` |
| `run_telegram.py` | 225 | Remover `às {kickoff}` |
| `run_telegram.py` | 180-211 | Nova lógica de cálculo de stakes |
| `run_telegram.py` | 238 | Texto: `Retorno possível duplo Green` |

---

## Observação sobre a Lógica

Entendi que você quer:
1. **Stake Casa** = valor fixo (stake_base da config)
2. **Stake Fora** = proporcional para equilibrar ganhos
3. **Stake Empate** = cobertura do risco
4. **Retorno** = média dos cenários de vitória (Casa ou Fora)

Isso é diferente da arbitragem tradicional onde as stakes são calculadas para garantir lucro igual em qualquer resultado.

