#!/usr/bin/env python3
"""
Telegram DG Bot Runner - Detecta Duplo Greens e envia ao Telegram.

Este micro-serviço roda via PM2 e monitora a view odds_comparison
para detectar oportunidades de Duplo Green em tempo real.

Uso:
    python run_telegram.py --interval 60
    python run_telegram.py --interval 30 --debug
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from loguru import logger
import httpx

from supabase_client import SupabaseClient

# Casas exclusivamente SO (não usadas para Duplo Green Casa/Fora)
SO_BOOKMAKERS = ['betbra', 'betnacional', 'tradeball']


def is_so_bookmaker(name: str, odds_type: str = None) -> bool:
    """Verifica se a casa é do tipo Só Odds (SO)."""
    name_lower = name.lower()
    return odds_type == 'SO' or any(b in name_lower for b in SO_BOOKMAKERS)


class TelegramDGBot:
    """Bot para detecção e envio de Duplo Greens ao Telegram."""
    
    def __init__(self):
        self.supabase = SupabaseClient()
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.channel_id = os.getenv('TELEGRAM_CHANNEL_ID')
        self.logger = logger.bind(component="telegram-dg")
        self.config = None
        
        if not self.bot_token or not self.channel_id:
            self.logger.warning("TELEGRAM_BOT_TOKEN ou TELEGRAM_CHANNEL_ID não configurados")
    
    async def load_config(self):
        """Carrega configuração do banco."""
        try:
            response = self.supabase.client.table('telegram_bot_config').select('*').limit(1).single().execute()
            self.config = response.data
            return self.config
        except Exception as e:
            self.logger.error(f"Erro ao carregar config: {e}")
            return None
    
    def is_within_schedule(self) -> bool:
        """Verifica se está dentro do horário permitido."""
        if not self.config:
            return False
        
        now = datetime.now().time()
        
        # Parse horário (pode vir como HH:MM:SS ou HH:MM)
        inicio_str = str(self.config['horario_inicio'])
        fim_str = str(self.config['horario_fim'])
        
        try:
            if len(inicio_str) == 5:
                inicio_str += ':00'
            if len(fim_str) == 5:
                fim_str += ':00'
            
            inicio = datetime.strptime(inicio_str, '%H:%M:%S').time()
            fim = datetime.strptime(fim_str, '%H:%M:%S').time()
        except ValueError:
            self.logger.error(f"Formato de horário inválido: {inicio_str} / {fim_str}")
            return True  # Em caso de erro, permite execução
        
        # Se fim < inicio, significa que cruza meia-noite (ex: 06:00 até 00:00)
        if fim < inicio:
            # Está no horário se: now >= inicio OU now <= fim
            return now >= inicio or now <= fim
        else:
            # Horário normal: inicio <= now <= fim
            return inicio <= now <= fim
    
    async def fetch_odds(self) -> list:
        """Busca odds da view de comparação."""
        try:
            response = self.supabase.client.table('odds_comparison').select('*').execute()
            return response.data or []
        except Exception as e:
            self.logger.error(f"Erro ao buscar odds: {e}")
            return []
    
    async def get_enviados_ids(self) -> set:
        """Retorna IDs de matches já enviados hoje."""
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
        # Basquete não tem empate
        if match['sport_type'] == 'basketball':
            return None
        
        odds = match['odds']
        
        # Separar odds PA e SO
        pa_odds = [o for o in odds if not is_so_bookmaker(o['bookmaker_name'], o.get('odds_type'))]
        so_odds = [o for o in odds if is_so_bookmaker(o['bookmaker_name'], o.get('odds_type'))]
        
        if not pa_odds or not so_odds:
            return None
        
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
        
        # Melhor Empate (SO) - prioriza Betbra
        so_with_draw = [o for o in so_odds if o.get('draw_odd')]
        if not so_with_draw:
            return None
        
        so_with_draw.sort(
            key=lambda x: ('betbra' in x['bookmaker_name'].lower(), x['draw_odd']), 
            reverse=True
        )
        best_draw = so_with_draw[0]
        
        home_odd = best_home['home_odd']
        away_odd = best_away['away_odd']
        draw_odd = best_draw['draw_odd']
        
        if not home_odd or not away_odd or not draw_odd:
            return None
        
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
        
        if roi < self.config['roi_minimo']:
            return None
        
        # Parse da data
        match_date_str = match['match_date'][:10] if match['match_date'] else ''
        kickoff_str = match['match_date'][11:16] if len(match['match_date']) > 11 else ''
        
        return {
            'match_id': match['match_id'],
            'team1': match['home_team'],
            'team2': match['away_team'],
            'competition': match['league_name'],
            'match_date': match_date_str,
            'kickoff': kickoff_str,
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
        if not self.bot_token or not self.channel_id:
            self.logger.warning("Telegram não configurado, pulando envio")
            return None
        
        roi_sign = '+' if dg['roi'] >= 0 else ''
        
        message = f"""🦈 <b>DUPLO GREEN ENCONTRADO</b> 🦈

⚽ <b>{dg['team1']} x {dg['team2']}</b>
🏆 {dg['competition']}
📅 {dg['match_date']}

🏠 <b>CASA (PA):</b> {dg['casa']['bookmaker']}
   └ ODD: {dg['casa']['odd']:.2f} | Stake: R$ {dg['casa']['stake']:.2f}

⚖️ <b>EMPATE (SO):</b> {dg['empate']['bookmaker']}
   └ ODD: {dg['empate']['odd']:.2f} | Risco: R$ {abs(dg['risco_empate']):.2f}

🚀 <b>FORA (PA):</b> {dg['fora']['bookmaker']}
   └ ODD: {dg['fora']['odd']:.2f} | Stake: R$ {dg['fora']['stake']:.2f}

💰 <b>Investimento:</b> R$ {dg['total_stake']:.2f}
📊 <b>ROI:</b> {roi_sign}{dg['roi']:.2f}%
✅ <b>Retorno possível duplo Green:</b> R$ {dg['retorno_green']:.2f}

🦈 #BetSharkPro #DuploGreen"""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
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
            # Ignora erro de duplicata (constraint única)
            if 'duplicate key' not in str(e).lower():
                self.logger.error(f"Erro ao salvar enviado: {e}")
    
    async def run_cycle(self) -> int:
        """Executa um ciclo de detecção."""
        # Recarregar config
        await self.load_config()
        
        if not self.config:
            self.logger.warning("Config não encontrada")
            return 0
        
        if not self.config.get('enabled'):
            self.logger.debug("Bot desativado")
            return 0
        
        if not self.is_within_schedule():
            self.logger.debug(f"Fora do horário ({self.config['horario_inicio']} - {self.config['horario_fim']})")
            return 0
        
        # Buscar dados
        odds = await self.fetch_odds()
        enviados = await self.get_enviados_ids()
        
        self.logger.info(f"Buscando DGs: {len(odds)} odds, {len(enviados)} já enviados hoje")
        
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
            
            # Pequeno intervalo entre envios para não sobrecarregar
            await asyncio.sleep(2)
        
        return dgs_encontrados


async def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description='Telegram DG Bot Runner')
    parser.add_argument('--interval', type=int, default=60, 
                        help='Intervalo entre ciclos (segundos)')
    parser.add_argument('--debug', action='store_true', 
                        help='Ativar logs de debug')
    args = parser.parse_args()
    
    # Configurar logger
    logger.remove()
    logger.add(
        sys.stderr, 
        level='DEBUG' if args.debug else 'INFO',
        format="<green>{time:HH:mm:ss}</green> | <level>{level:7}</level> | <cyan>{extra[component]:12}</cyan> | {message}"
    )
    
    bot = TelegramDGBot()
    log = logger.bind(component="telegram-dg")
    
    log.info(f"Starting Telegram DG Bot (interval: {args.interval}s)")
    
    while True:
        try:
            count = await bot.run_cycle()
            if count:
                log.info(f"Ciclo completo: {count} DGs enviados")
            else:
                log.debug("Ciclo completo: 0 DGs")
        except Exception as e:
            log.error(f"Erro no ciclo: {e}")
        
        try:
            await asyncio.sleep(args.interval)
        except asyncio.CancelledError:
            log.info("Shutting down...")
            break


if __name__ == "__main__":
    asyncio.run(main())
