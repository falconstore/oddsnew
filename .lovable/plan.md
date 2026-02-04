
# Plano: Bot Telegram Duplo Green via PM2

## Visao Geral

Criar um micro-servico Python que roda em loop via PM2, detectando oportunidades de Duplo Green em tempo real a partir da view `odds_comparison` existente e enviando alertas automaticos para o Telegram.

---

## Arquitetura

```text
+-------------------+       +--------------------+       +------------------+
|  Frontend React   |       |   Python Service   |       |     Telegram     |
|  TelegramBot.tsx  | ----> |   run_telegram.py  | ----> |     API          |
+-------------------+       +--------------------+       +------------------+
        |                           |
        |   Configuracoes           |  Detecta DG a partir
        |   via Supabase            |  da view odds_comparison
        v                           v
+-------------------+       +--------------------+
|  telegram_bot_    |       |  telegram_dg_      |
|  config (table)   |       |  enviados (table)  |
+-------------------+       +--------------------+
```

---

## Componentes a Criar

### 1. Backend Python (VPS)

| Arquivo | Descricao |
|---------|-----------|
| `docs/scraper/standalone/run_telegram.py` | Micro-servico que roda via PM2 |
| `docs/scraper/telegram_bot.py` | Classe TelegramBot com logica de deteccao |

### 2. Supabase (Tabelas)

| Tabela | Descricao |
|--------|-----------|
| `telegram_bot_config` | Configuracoes do bot (ROI, stake, horarios) |
| `telegram_dg_enviados` | Historico de DGs ja enviados |

### 3. Frontend React

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/TelegramBot.tsx` | Pagina de configuracao |
| `src/hooks/useTelegramBot.ts` | Hooks para dados |
| `src/types/telegram.ts` | Tipos TypeScript |
| `src/components/Sidebar.tsx` | Novo item de menu |
| `src/components/AnimatedRoutes.tsx` | Nova rota |
| `src/types/auth.ts` | Nova permissao |

---

## Logica de Deteccao (Python)

O servico utiliza a mesma logica da pagina Freebet Extraction:

1. **Buscar odds da view `odds_comparison`**
2. **Para cada partida de futebol:**
   - Obter melhor odd PA para Casa (maior odd de casas nao-SO)
   - Obter melhor odd SO para Empate (Betbra/Betnacional/Tradeball)
   - Obter melhor odd PA para Fora (maior odd de casas nao-SO)
3. **Calcular ROI do Duplo Green:**
   ```python
   # Duplo Green = Casa + Fora (ignora empate)
   arbitragem = (1/odd_casa) + (1/odd_fora)
   roi = (1 - arbitragem) * 100  # Negativo = risco no empate
   ```
4. **Se ROI >= ROI_MINIMO configurado:**
   - Calcular stakes baseado no stake_base
   - Verificar se ja foi enviado (match_id + data)
   - Enviar ao Telegram
   - Registrar em `telegram_dg_enviados`

---

## Migracao SQL

Arquivo: `docs/migration-telegram-bot.sql`

```sql
-- Tabela de configuracao do bot
CREATE TABLE public.telegram_bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT false,
  roi_minimo DECIMAL(5,2) DEFAULT -5.0,
  stake_base DECIMAL(10,2) DEFAULT 1000.00,
  intervalo_segundos INTEGER DEFAULT 60,
  horario_inicio TIME DEFAULT '06:00',
  horario_fim TIME DEFAULT '23:00',
  url_site TEXT DEFAULT 'WWW.BETSHARKPRO.COM.BR',
  bookmakers_links JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuracao inicial
INSERT INTO public.telegram_bot_config (id) 
VALUES (gen_random_uuid());

-- Historico de DGs enviados
CREATE TABLE public.telegram_dg_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  team1 TEXT NOT NULL,
  team2 TEXT NOT NULL,
  competition TEXT NOT NULL,
  match_date TEXT NOT NULL,
  roi DECIMAL(5,2) NOT NULL,
  stake_casa DECIMAL(10,2),
  stake_empate DECIMAL(10,2),
  stake_fora DECIMAL(10,2),
  retorno_green DECIMAL(10,2) NOT NULL,
  casa_bookmaker TEXT,
  casa_odd DECIMAL(5,2),
  empate_bookmaker TEXT,
  empate_odd DECIMAL(5,2),
  fora_bookmaker TEXT,
  fora_odd DECIMAL(5,2),
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para evitar duplicatas
CREATE UNIQUE INDEX idx_telegram_dg_match_date 
ON public.telegram_dg_enviados(match_id, match_date);

-- Indice para busca por data
CREATE INDEX idx_telegram_dg_created 
ON public.telegram_dg_enviados(created_at DESC);

-- RLS policies
ALTER TABLE public.telegram_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_dg_enviados ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para usuarios autenticados
CREATE POLICY "Allow authenticated read config" 
ON public.telegram_bot_config FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Allow authenticated read enviados" 
ON public.telegram_dg_enviados FOR SELECT 
TO authenticated USING (true);
```

---

## Runner Python: run_telegram.py

```python
#!/usr/bin/env python3
"""
Telegram DG Bot Runner - Detecta Duplo Greens e envia ao Telegram.

Uso:
    python run_telegram.py --interval 60
    python run_telegram.py --interval 30 --debug
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, time

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from loguru import logger
import httpx

from config import settings
from supabase_client import SupabaseClient

# Casas exclusivamente SO (nao usadas para Duplo Green Casa/Fora)
SO_BOOKMAKERS = ['betbra', 'betnacional', 'tradeball']

def is_so_bookmaker(name: str, odds_type: str = None) -> bool:
    name_lower = name.lower()
    return odds_type == 'SO' or any(b in name_lower for b in SO_BOOKMAKERS)

class TelegramDGBot:
    def __init__(self):
        self.supabase = SupabaseClient()
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.channel_id = os.getenv('TELEGRAM_CHANNEL_ID')
        self.logger = logger.bind(component="telegram-dg")
        self.config = None
    
    async def load_config(self):
        """Carrega configuracao do banco."""
        try:
            response = self.supabase.client.table('telegram_bot_config').select('*').limit(1).single().execute()
            self.config = response.data
            return self.config
        except Exception as e:
            self.logger.error(f"Erro ao carregar config: {e}")
            return None
    
    def is_within_schedule(self) -> bool:
        """Verifica se esta dentro do horario permitido."""
        if not self.config:
            return False
        
        now = datetime.now().time()
        inicio = datetime.strptime(self.config['horario_inicio'], '%H:%M:%S').time()
        fim = datetime.strptime(self.config['horario_fim'], '%H:%M:%S').time()
        
        return inicio <= now <= fim
    
    async def fetch_odds(self) -> list:
        """Busca odds da view de comparacao."""
        try:
            response = self.supabase.client.table('odds_comparison').select('*').execute()
            return response.data or []
        except Exception as e:
            self.logger.error(f"Erro ao buscar odds: {e}")
            return []
    
    async def get_enviados_ids(self) -> set:
        """Retorna IDs de matches ja enviados hoje."""
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            response = (
                self.supabase.client.table('telegram_dg_enviados')
                .select('match_id')
                .gte('created_at', f'{today}T00:00:00')
                .execute()
            )
            return {r['match_id'] for r in response.data or []}
        except Exception as e:
            self.logger.error(f"Erro ao buscar enviados: {e}")
            return set()
    
    def group_odds_by_match(self, odds_list: list) -> dict:
        """Agrupa odds por match_id."""
        matches = {}
        for odd in odds_list:
            mid = odd['match_id']
            if mid not in matches:
                matches[mid] = {
                    'match_id': mid,
                    'home_team': odd['home_team'],
                    'away_team': odd['away_team'],
                    'league_name': odd['league_name'],
                    'match_date': odd['match_date'],
                    'sport_type': odd.get('sport_type', 'football'),
                    'odds': []
                }
            matches[mid]['odds'].append(odd)
        return matches
    
    def calculate_dg(self, match: dict) -> dict | None:
        """Calcula oportunidade de Duplo Green para uma partida."""
        if match['sport_type'] == 'basketball':
            return None  # Basquete nao tem empate
        
        odds = match['odds']
        
        # Melhores PA para Casa e Fora
        pa_odds = [o for o in odds if not is_so_bookmaker(o['bookmaker_name'], o.get('odds_type'))]
        so_odds = [o for o in odds if is_so_bookmaker(o['bookmaker_name'], o.get('odds_type'))]
        
        if not pa_odds or not so_odds:
            return None
        
        # Melhor Casa (PA)
        best_home = max(pa_odds, key=lambda x: x['home_odd'] or 0)
        # Melhor Fora (PA)
        best_away = max(pa_odds, key=lambda x: x['away_odd'] or 0)
        # Melhor Empate (SO) - prioriza Betbra
        so_with_draw = [o for o in so_odds if o.get('draw_odd')]
        if not so_with_draw:
            return None
        
        so_with_draw.sort(key=lambda x: ('betbra' in x['bookmaker_name'].lower(), x['draw_odd']), reverse=True)
        best_draw = so_with_draw[0]
        
        home_odd = best_home['home_odd']
        away_odd = best_away['away_odd']
        draw_odd = best_draw['draw_odd']
        
        if not home_odd or not away_odd or not draw_odd:
            return None
        
        # Calcular ROI do Duplo Green
        arb = (1/home_odd) + (1/away_odd)
        roi = (1 - arb) * 100
        
        if roi < self.config['roi_minimo']:
            return None
        
        # Calcular stakes
        stake_base = self.config['stake_base']
        total_stake = stake_base
        stake_casa = total_stake * (1/home_odd) / arb
        stake_fora = total_stake * (1/away_odd) / arb
        
        # Retorno green = ganho se Casa ou Fora
        retorno_green = stake_casa * home_odd  # ou stake_fora * away_odd
        
        # Stake do empate (risco)
        risco_empate = total_stake - retorno_green
        stake_empate = abs(risco_empate) / (draw_odd - 1) if draw_odd > 1 else 0
        
        return {
            'match_id': match['match_id'],
            'team1': match['home_team'],
            'team2': match['away_team'],
            'competition': match['league_name'],
            'match_date': match['match_date'][:10],
            'kickoff': match['match_date'][11:16],
            'roi': roi,
            'casa': {'bookmaker': best_home['bookmaker_name'], 'odd': home_odd, 'stake': stake_casa},
            'empate': {'bookmaker': best_draw['bookmaker_name'], 'odd': draw_odd, 'stake': stake_empate},
            'fora': {'bookmaker': best_away['bookmaker_name'], 'odd': away_odd, 'stake': stake_fora},
            'total_stake': stake_casa + stake_fora,
            'retorno_green': retorno_green,
            'risco_empate': risco_empate,
        }
    
    async def send_telegram(self, dg: dict) -> int | None:
        """Envia mensagem ao Telegram."""
        roi_sign = '+' if dg['roi'] >= 0 else ''
        
        message = f"""🦈 <b>DG ENCONTRADO</b> 🦈

⚽ <b>{dg['team1']} x {dg['team2']}</b>
🏆 {dg['competition']}
📅 {dg['match_date']} às {dg['kickoff']}

🏠 <b>CASA (PA):</b> {dg['casa']['bookmaker']}
   └ ODD: {dg['casa']['odd']:.2f} | Stake: R$ {dg['casa']['stake']:.2f}

⚖️ <b>EMPATE (SO):</b> {dg['empate']['bookmaker']}
   └ ODD: {dg['empate']['odd']:.2f} | Risco: R$ {abs(dg['risco_empate']):.2f}

🚀 <b>FORA (PA):</b> {dg['fora']['bookmaker']}
   └ ODD: {dg['fora']['odd']:.2f} | Stake: R$ {dg['fora']['stake']:.2f}

💰 <b>Investimento:</b> R$ {dg['total_stake']:.2f}
📊 <b>ROI:</b> {roi_sign}{dg['roi']:.2f}%
✅ <b>Retorno Green:</b> R$ {dg['retorno_green']:.2f}

🦈 #BetSharkPro #DuploGreen"""

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                    json={
                        'chat_id': self.channel_id,
                        'text': message,
                        'parse_mode': 'HTML',
                        'disable_web_page_preview': True
                    }
                )
                result = response.json()
                if result.get('ok'):
                    return result['result']['message_id']
                else:
                    self.logger.error(f"Telegram error: {result}")
                    return None
        except Exception as e:
            self.logger.error(f"Erro ao enviar Telegram: {e}")
            return None
    
    async def save_enviado(self, dg: dict, message_id: int | None):
        """Salva registro do DG enviado."""
        try:
            self.supabase.client.table('telegram_dg_enviados').insert({
                'match_id': dg['match_id'],
                'team1': dg['team1'],
                'team2': dg['team2'],
                'competition': dg['competition'],
                'match_date': dg['match_date'],
                'roi': dg['roi'],
                'stake_casa': dg['casa']['stake'],
                'stake_empate': dg['empate']['stake'],
                'stake_fora': dg['fora']['stake'],
                'retorno_green': dg['retorno_green'],
                'casa_bookmaker': dg['casa']['bookmaker'],
                'casa_odd': dg['casa']['odd'],
                'empate_bookmaker': dg['empate']['bookmaker'],
                'empate_odd': dg['empate']['odd'],
                'fora_bookmaker': dg['fora']['bookmaker'],
                'fora_odd': dg['fora']['odd'],
                'telegram_message_id': message_id,
            }).execute()
        except Exception as e:
            self.logger.error(f"Erro ao salvar enviado: {e}")
    
    async def run_cycle(self) -> int:
        """Executa um ciclo de deteccao."""
        # Recarregar config
        await self.load_config()
        
        if not self.config or not self.config.get('enabled'):
            self.logger.debug("Bot desativado")
            return 0
        
        if not self.is_within_schedule():
            self.logger.debug("Fora do horario")
            return 0
        
        # Buscar dados
        odds = await self.fetch_odds()
        enviados = await self.get_enviados_ids()
        
        # Agrupar e processar
        matches = self.group_odds_by_match(odds)
        dgs_encontrados = 0
        
        for match_id, match in matches.items():
            if match_id in enviados:
                continue
            
            dg = self.calculate_dg(match)
            if not dg:
                continue
            
            dgs_encontrados += 1
            self.logger.info(f"DG encontrado: {dg['team1']} x {dg['team2']} (ROI: {dg['roi']:.2f}%)")
            
            # Enviar ao Telegram
            msg_id = await self.send_telegram(dg)
            await self.save_enviado(dg, msg_id)
            
            # Intervalo entre envios
            await asyncio.sleep(self.config.get('intervalo_segundos', 60))
        
        return dgs_encontrados


async def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser()
    parser.add_argument('--interval', type=int, default=60)
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()
    
    logger.remove()
    logger.add(sys.stderr, level='DEBUG' if args.debug else 'INFO',
               format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | <cyan>{extra[component]}</cyan> | {message}")
    
    bot = TelegramDGBot()
    log = logger.bind(component="telegram-dg")
    
    log.info(f"Starting Telegram DG Bot (interval: {args.interval}s)")
    
    while True:
        try:
            count = await bot.run_cycle()
            if count:
                log.info(f"Ciclo completo: {count} DGs enviados")
        except Exception as e:
            log.error(f"Erro no ciclo: {e}")
        
        try:
            await asyncio.sleep(args.interval)
        except asyncio.CancelledError:
            log.info("Shutting down...")
            break


if __name__ == "__main__":
    asyncio.run(main())
```

---

## Configuracao PM2

Adicionar ao `ecosystem.config.js`:

```javascript
{
  name: 'telegram-dg-bot',
  script: 'standalone/run_telegram.py',
  interpreter: 'python3',
  args: '--interval 60',
  cwd: __dirname,
  max_memory_restart: '100M',
  restart_delay: 5000,
  max_restarts: 50,
  autorestart: true,
  env: {
    PYTHONUNBUFFERED: '1'
  }
}
```

---

## Secrets Necessarios (.env)

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=seu_token_aqui
TELEGRAM_CHANNEL_ID=-100xxxxxxxxxx
```

---

## Frontend: Arquivos a Criar/Modificar

### src/types/telegram.ts

```typescript
export interface TelegramBotConfig {
  id: string;
  enabled: boolean;
  roi_minimo: number;
  stake_base: number;
  intervalo_segundos: number;
  horario_inicio: string;
  horario_fim: string;
  url_site: string;
  bookmakers_links: Record<string, string>;
  updated_at: string;
}

export interface TelegramDGEnviado {
  id: string;
  match_id: string;
  team1: string;
  team2: string;
  competition: string;
  match_date: string;
  roi: number;
  stake_casa: number;
  stake_empate: number;
  stake_fora: number;
  retorno_green: number;
  casa_bookmaker: string;
  casa_odd: number;
  empate_bookmaker: string;
  empate_odd: number;
  fora_bookmaker: string;
  fora_odd: number;
  telegram_message_id: number | null;
  created_at: string;
}
```

### src/types/auth.ts

Adicionar nova permissao:

```typescript
export const PAGE_KEYS = {
  // ... existentes ...
  TELEGRAM_BOT: 'telegram_bot',
} as const;

// Adicionar em PAGE_CONFIG:
[PAGE_KEYS.TELEGRAM_BOT]: { 
  label: 'Bot Telegram', 
  description: 'Configurar bot de Duplo Green'
},
```

### src/hooks/useTelegramBot.ts

Adaptar o componente enviado para funcionar com Supabase diretamente.

### src/pages/TelegramBot.tsx

Adaptar o TelegramBotConfig.tsx enviado como pagina principal.

### src/components/Sidebar.tsx

Adicionar item de menu:

```tsx
{
  icon: Bot,
  label: 'Bot Telegram',
  path: '/telegram-bot',
  pageKey: PAGE_KEYS.TELEGRAM_BOT,
}
```

### src/components/AnimatedRoutes.tsx

Adicionar rota:

```tsx
<Route path="/telegram-bot" element={<TelegramBot />} />
```

---

## Ordem de Implementacao

1. Criar migracao SQL (`docs/migration-telegram-bot.sql`)
2. Criar runner Python (`docs/scraper/standalone/run_telegram.py`)
3. Adicionar tipos TypeScript (`src/types/telegram.ts`)
4. Modificar `src/types/auth.ts` (nova permissao)
5. Criar hooks (`src/hooks/useTelegramBot.ts`)
6. Criar pagina (`src/pages/TelegramBot.tsx`)
7. Modificar Sidebar e AnimatedRoutes
8. Adicionar ao `ecosystem.config.js`
9. Configurar secrets no .env da VPS
10. Testar fluxo completo

---

## Vantagens desta Abordagem

| Aspecto | Beneficio |
|---------|-----------|
| Tempo Real | Detecta DGs assim que odds sao atualizadas |
| Integracao | Usa mesma infra de scrapers (PM2, Supabase) |
| Baixo Custo | Nao precisa de edge function paga |
| Controle | Config via frontend, execucao na VPS |
| Resiliencia | PM2 reinicia automaticamente em caso de erro |
| Historico | Registro completo de DGs enviados no banco |
