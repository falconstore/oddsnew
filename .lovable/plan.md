

# Melhorias no Bot Telegram - 3 Correcoes

## Problema 1: Horario Errado

O bot exibe o horario da partida em UTC (00:30) em vez do horario de Brasilia (21:30). A causa esta nas linhas 352-353 do `run_telegram.py`:

```python
match_date_str = match['match_date'][:10]
kickoff_str = match['match_date'][11:16]
```

O codigo simplesmente fatia a string ISO do banco (que esta em UTC) sem converter para o fuso horario local. Desde 2019, o Brasil nao usa mais horario de verao, entao UTC-3 e fixo.

### Correcao

Na funcao `calculate_dg()`, ao processar `match['match_date']`, converter de UTC para UTC-3 antes de extrair data e hora:

```python
from datetime import datetime, timedelta, timezone

# Converter UTC -> Brasilia (UTC-3)
raw_date = match['match_date']
try:
    if 'T' in raw_date:
        utc_dt = datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
    else:
        utc_dt = datetime.strptime(raw_date[:19], '%Y-%m-%d %H:%M:%S')
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    
    brasilia_dt = utc_dt + timedelta(hours=-3)
    match_date_str = brasilia_dt.strftime('%Y-%m-%d')
    kickoff_str = brasilia_dt.strftime('%H:%M')
except:
    match_date_str = raw_date[:10] if raw_date else ''
    kickoff_str = raw_date[11:16] if len(raw_date) > 11 else ''
```

---

## Problema 2: Mensagens Duplicadas Sem Parar

O sistema atual de deduplicacao apenas verifica se o `match_id` ja foi enviado hoje (via banco). Isso causa dois problemas:

- Se o DG e detectado em cada ciclo (a cada 60s) com as mesmas odds, ele tenta enviar novamente
- A unica protecao e o indice unico `(match_id, match_date)` no banco, que impede o INSERT mas nao impede o envio da mensagem no Telegram

O usuario quer:
- **Nao reenviar** se nada mudou (mesmas casas e odds)
- **Reenviar** se algo mudou (casa diferente ou odd diferente)
- **Minimo 45 segundos** entre envios consecutivos

### Correcao

Adicionar um sistema de cache em memoria na classe `TelegramDGBot`:

1. **Dicionario `_last_sent_state`**: Armazena por `match_id` o estado enviado (bookmakers + odds)
2. **Timestamp `_last_send_time`**: Controla o intervalo minimo entre envios
3. **Metodo `_has_changed()`**: Compara estado atual com o ultimo enviado

```python
def __init__(self):
    ...
    self._last_sent_state = {}   # match_id -> {casa_bk, casa_odd, empate_bk, ...}
    self._last_send_time = 0     # timestamp do ultimo envio

def _build_state_key(self, dg: dict) -> dict:
    """Cria fingerprint do DG para comparacao."""
    return {
        'casa_bk': dg['casa']['bookmaker'],
        'casa_odd': round(dg['casa']['odd'], 2),
        'empate_bk': dg['empate']['bookmaker'],
        'empate_odd': round(dg['empate']['odd'], 2),
        'fora_bk': dg['fora']['bookmaker'],
        'fora_odd': round(dg['fora']['odd'], 2),
    }

def _has_changed(self, match_id: str, dg: dict) -> bool:
    """Verifica se o DG mudou desde o ultimo envio."""
    current_state = self._build_state_key(dg)
    last_state = self._last_sent_state.get(match_id)
    if last_state is None:
        return True  # Nunca foi enviado nesta sessao
    return current_state != last_state
```

No `run_cycle()`, a logica muda para:

```python
for match_id, match in matches.items():
    dg = self.calculate_dg(match)
    if not dg:
        continue
    
    # Verificar se mudou desde ultimo envio
    if not self._has_changed(match_id, dg):
        continue  # Sem mudanca, pular
    
    # Verificar delay minimo de 45 segundos
    now = time.time()
    elapsed = now - self._last_send_time
    if elapsed < 45:
        await asyncio.sleep(45 - elapsed)
    
    # Enviar
    msg_id = await self.send_telegram(dg)
    if msg_id is not None:
        await self.save_enviado(dg, msg_id)
        self._last_sent_state[match_id] = self._build_state_key(dg)
        self._last_send_time = time.time()
```

A verificacao de `enviados` (banco) e removida - o controle agora e feito pelo cache em memoria. Isso permite reenviar se houver mudanca, mas nao reenviar se estiver igual.

O indice unico `(match_id, match_date)` no banco precisa ser removido ou alterado, ja que agora queremos permitir multiplos registros do mesmo match quando houver mudanca.

### Mudanca no banco

```sql
DROP INDEX IF EXISTS idx_telegram_dg_match_date;
```

---

## Problema 3: Adicionar ROI em R$

O bot mostra apenas `ROI: +0.06%` mas o usuario quer tambem o valor em Reais.

O ROI em R$ e o lucro simples: `retorno_green - total_stake` (lucro se acertar 1 resultado).

### Correcao

Na mensagem do Telegram (metodo `send_telegram`), adicionar uma linha:

```
Antes:
📊 ROI: +0.06%
✅ Lucro Duplo Green: +R$ 1701.04

Depois:
📊 ROI: +0.06% (R$ +1.02)
✅ Lucro Duplo Green: +R$ 1701.04
```

O calculo do ROI em R$ ja existe no `calculate_dg()` como `lucro_simples = retorno_green - total_stake`. Basta adiciona-lo ao retorno e a mensagem.

No dicionario retornado por `calculate_dg()`, adicionar:

```python
'roi_reais': lucro_simples,  # ROI em R$
```

Na mensagem:

```python
roi_reais_sign = '+' if dg['roi_reais'] >= 0 else ''
# Linha atualizada:
f"📊 <b>ROI:</b> {roi_sign}{dg['roi']:.2f}% ({roi_reais_sign}R$ {dg['roi_reais']:.2f})"
```

---

## Resumo das mudancas

### Arquivo: `docs/scraper/standalone/run_telegram.py`

| Local | Mudanca |
|---|---|
| `__init__()` | Adicionar `self._last_sent_state = {}` e `self._last_send_time = 0` |
| Nova funcao `_build_state_key()` | Cria fingerprint do DG |
| Nova funcao `_has_changed()` | Compara com ultimo envio |
| `calculate_dg()` linhas 352-353 | Converter UTC para UTC-3 (Brasilia) |
| `calculate_dg()` retorno | Adicionar campo `roi_reais` |
| `send_telegram()` mensagem | Adicionar ROI em R$ na linha do ROI |
| `run_cycle()` linhas 518-541 | Substituir logica de dedup por cache + delay 45s |
| Import | Adicionar `import time` |

### Banco de dados (SQL manual)

```sql
DROP INDEX IF EXISTS idx_telegram_dg_match_date;
```

Este DROP e necessario para permitir multiplos registros do mesmo match quando houver mudanca de odds.

### Nenhum outro arquivo afetado

O frontend (`TelegramBot.tsx`) e os tipos (`telegram.ts`) nao precisam de mudanca.

### Deploy

```text
1. Rodar SQL no Supabase: DROP INDEX IF EXISTS idx_telegram_dg_match_date;
2. git pull no VPS
3. pm2 restart telegram-dg-bot
4. pm2 logs telegram-dg-bot --lines 20
5. Esperado:
   - Horarios corretos (21:30 em vez de 00:30)
   - Sem mensagens duplicadas quando nada muda
   - Reenvio apenas quando casa ou odd muda (com delay de 45s)
   - ROI mostrando % e R$
```

