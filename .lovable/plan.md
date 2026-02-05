
# Plano: Melhorias na Mensagem do Telegram

## Resumo das Alterações

| Melhoria | Descrição |
|----------|-----------|
| **Botões inline** | Adicionar botões clicáveis para Casa, Empate, Fora e Calculadora |
| **Formato da data** | Mudar de `2026-02-07` para `07/02/2026 às 21:00` |
| **Cálculo retorno DG** | Corrigir para `lucro = retorno - investimento` (ex: 840 - 857.10 = -17.10) |

---

## 1. Adicionar Botões Inline no Telegram

O Telegram suporta botões clicáveis via `reply_markup` com `inline_keyboard`. Cada botão terá:
- **CASA**: Link para a casa da odd de Casa (PA)
- **EMPATE**: Link para a casa da odd de Empate (SO)
- **FORA**: Link para a casa da odd de Fora (PA)
- **CALCULADORA**: Link para o site (configurável)

### Alterações em `run_telegram.py`

**Método `calculate_dg`** - Adicionar extra_data ao retorno:
```python
return {
    # ... campos existentes ...
    'casa': {
        'bookmaker': best_home['bookmaker_name'], 
        'odd': home_odd, 
        'stake': stake_casa,
        'extra_data': best_home.get('extra_data', {})  # NOVO
    },
    'empate': {
        'bookmaker': best_draw['bookmaker_name'], 
        'odd': draw_odd, 
        'stake': stake_empate,
        'extra_data': best_draw.get('extra_data', {})  # NOVO
    },
    'fora': {
        'bookmaker': best_away['bookmaker_name'], 
        'odd': away_odd, 
        'stake': stake_fora,
        'extra_data': best_away.get('extra_data', {})  # NOVO
    },
}
```

**Novo método `generate_bookmaker_link`** - Gerar links (baseado em `bookmakerLinks.ts`):
```python
def generate_bookmaker_link(
    self, 
    bookmaker_name: str, 
    extra_data: dict, 
    home_team: str, 
    away_team: str
) -> str | None:
    """Gera link profundo para casa de apostas."""
    name = bookmaker_name.lower()
    
    def slugify(text: str) -> str:
        import unicodedata
        text = text.lower().replace(' ', '-')
        text = unicodedata.normalize('NFD', text)
        return ''.join(c for c in text if not unicodedata.combining(c))
    
    if 'betbra' in name:
        event_id = extra_data.get('betbra_event_id')
        market_id = extra_data.get('betbra_market_id')
        if event_id and market_id:
            return f"https://betbra.bet.br/b/exchange/sport/soccer/event/{event_id}/market/{market_id}"
    
    if 'sportingbet' in name:
        fixture_id = extra_data.get('fixture_id')
        if fixture_id:
            home_slug = slugify(home_team)
            away_slug = slugify(away_team)
            return f"https://www.sportingbet.bet.br/pt-br/sports/eventos/{home_slug}-{away_slug}-2:{fixture_id}?tab=score"
    
    if 'bet365' in name:
        url = extra_data.get('bet365_url')
        if url:
            return url
        event_id = extra_data.get('event_id')
        if event_id:
            return f"https://www.bet365.com/#/AC/B1/C1/D8/E{event_id}/F3/"
        return 'https://www.bet365.com/'
    
    if 'tradeball' in name:
        return 'https://betbra.bet.br/tradeball/dballTradingFeed'
    
    # ... outros bookmakers ...
    
    return None
```

**Método `send_telegram`** - Adicionar `reply_markup`:
```python
async def send_telegram(self, dg: dict) -> int | None:
    # ... construir mensagem ...
    
    # Gerar links para botões
    link_casa = self.generate_bookmaker_link(
        dg['casa']['bookmaker'], 
        dg['casa'].get('extra_data', {}),
        dg['team1'], dg['team2']
    )
    link_empate = self.generate_bookmaker_link(
        dg['empate']['bookmaker'], 
        dg['empate'].get('extra_data', {}),
        dg['team1'], dg['team2']
    )
    link_fora = self.generate_bookmaker_link(
        dg['fora']['bookmaker'], 
        dg['fora'].get('extra_data', {}),
        dg['team1'], dg['team2']
    )
    url_calculadora = self.config.get('url_site', 'https://sharkoddsnew.lovable.app')
    
    # Construir botões inline
    buttons = []
    if link_casa:
        buttons.append({'text': f'🏠 CASA: {dg["casa"]["bookmaker"].upper()}', 'url': link_casa})
    if link_empate:
        buttons.append({'text': f'🤝 EMPATE: {dg["empate"]["bookmaker"].upper()}', 'url': link_empate})
    if link_fora:
        buttons.append({'text': f'🚀 FORA: {dg["fora"]["bookmaker"].upper()}', 'url': link_fora})
    buttons.append({'text': '🧮 CALCULADORA', 'url': url_calculadora})
    
    inline_keyboard = [[btn] for btn in buttons]  # Um botão por linha
    
    response = await client.post(
        f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
        json={
            'chat_id': self.channel_id,
            'text': message,
            'parse_mode': 'HTML',
            'disable_web_page_preview': True,
            'reply_markup': {'inline_keyboard': inline_keyboard}  # NOVO
        }
    )
```

---

## 2. Corrigir Formato da Data

### De:
```text
📅 2026-02-07
```

### Para:
```text
📅 07/02/2026 às 21:00
```

### Alteração no método `send_telegram`:
```python
# Formatar data no padrão brasileiro
date_parts = dg['match_date'].split('-')  # ['2026', '02', '07']
if len(date_parts) == 3:
    formatted_date = f"{date_parts[2]}/{date_parts[1]}/{date_parts[0]}"
else:
    formatted_date = dg['match_date']

kickoff = dg.get('kickoff', '')
date_display = f"{formatted_date} às {kickoff}" if kickoff else formatted_date

message = f"""🦈 <b>DUPLO GREEN ENCONTRADO</b> 🦈

⚽ <b>{dg['team1']} x {dg['team2']}</b>
🏆 {dg['competition']}
📅 {date_display}
...
"""
```

---

## 3. Corrigir Cálculo do Retorno Duplo Green

### Entendimento Correto

O "Retorno possível duplo Green" deve mostrar o **lucro líquido** quando Casa ou Fora ganham:

```text
Exemplo com Manchester United x Tottenham:
- stake_casa = 500, odd_casa = 1.68 → retorno = 840
- stake_fora = 176.84, odd_fora = 4.75 → retorno = 840
- stake_empate = 180.26

Investimento total = 500 + 176.84 + 180.26 = 857.10
Retorno bruto = 840
Lucro = 840 - 857.10 = -17.10 (perda)
```

O campo atual `lucro` já calcula isso corretamente! O problema é que a mensagem mostra `retorno_green` (840) em vez de `lucro` (-17.10).

### Correção na mensagem:
```python
# Na mensagem, usar lucro em vez de retorno_green
lucro_sign = '+' if dg['lucro'] >= 0 else ''

message = f"""...
💰 <b>Investimento:</b> R$ {dg['total_stake']:.2f}
📊 <b>ROI:</b> {roi_sign}{dg['roi']:.2f}%
✅ <b>Lucro Duplo Green:</b> {lucro_sign}R$ {dg['lucro']:.2f}
..."""
```

---

## Resumo das Alterações

### Arquivo: `docs/scraper/standalone/run_telegram.py`

| Função | Alteração |
|--------|-----------|
| `calculate_dg` | Incluir `extra_data` em cada resultado (casa/empate/fora) |
| `generate_bookmaker_link` | Nova função para gerar links profundos |
| `send_telegram` | Formatar data BR, adicionar botões inline, corrigir exibição do lucro |

---

## Resultado Esperado

### Mensagem Nova:
```text
🦈 DUPLO GREEN ENCONTRADO 🦈

⚽ Manchester United x Tottenham
🏆 Premier League
📅 07/02/2026 às 21:00

🏠 CASA (PA): sportingbet
   └ ODD: 1.68 | Stake: R$ 500.00

⚖️ EMPATE (SO): Tradeball
   └ ODD: 4.66 | Stake: R$ 180.26

🚀 FORA (PA): Bet365
   └ ODD: 4.75 | Stake: R$ 176.84

💰 Investimento: R$ 857.10
📊 ROI: -2.00%
✅ Lucro Duplo Green: -R$ 17.10

🦈 #BetSharkPro #DuploGreen

[🏠 CASA: SPORTINGBET]  ← botão clicável
[🤝 EMPATE: TRADEBALL]  ← botão clicável
[🚀 FORA: BET365]       ← botão clicável
[🧮 CALCULADORA]        ← botão clicável
```
