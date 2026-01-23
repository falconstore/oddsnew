#!/usr/bin/env python3
"""
Script de diagnóstico para Tradeball.
Testa conectividade, token e cookies antes de rodar o scraper principal.

Uso: python diagnose_tradeball.py
"""
import asyncio
import httpx
import json
from datetime import datetime

try:
    from config import settings
except ImportError:
    settings = None

API_BASE = "https://tradeball.betbra.bet.br/api/feedDball/list"
APP_ID = "6053e9c1-2e0a-4d83-875b-75a0fb2b3eef"

# Fallback hardcoded (para teste inicial)
FALLBACK_TOKEN = "27464971|PMcTBXps5wUglSWpSs5sbZTAXueeKMJ8sNzy4uZP"


def parse_cookies(raw_cookies: str) -> dict:
    """Parse cookie string into dict."""
    cookies = {}
    if not raw_cookies:
        return cookies
    for item in raw_cookies.replace('\n', '').strip().split('; '):
        if '=' in item:
            k, v = item.split('=', 1)
            cookies[k] = v
    return cookies


async def diagnose():
    print("=" * 60)
    print("DIAGNÓSTICO TRADEBALL")
    print(f"Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 1. Verificar configuração do token
    token = None
    if settings:
        token = getattr(settings, 'tradeball_auth_token', None)
    
    print(f"\n[1] TOKEN:")
    if token:
        print(f"    ✓ Configurado no .env: {token[:30]}...")
    else:
        print("    ✗ NÃO configurado no .env - usando hardcoded (pode estar expirado)")
        token = FALLBACK_TOKEN
    
    # 2. Verificar configuração dos cookies
    cookies_raw = None
    if settings:
        cookies_raw = getattr(settings, 'tradeball_cookies', None)
    
    print(f"\n[2] COOKIES:")
    if cookies_raw:
        cookies = parse_cookies(cookies_raw)
        print(f"    ✓ Configurado no .env: {len(cookies)} cookies")
        # Verificar cookies importantes
        important_cookies = ['SESS', 'BIAB_CUSTOMER', 'sb', 'C_U_I']
        for c in important_cookies:
            status = "✓" if c in cookies else "✗"
            print(f"       {status} {c}")
    else:
        print("    ✗ NÃO configurado no .env - usando hardcoded")
        cookies = {}
    
    # 3. Testar conectividade básica
    print(f"\n[3] CONECTIVIDADE:")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://tradeball.betbra.bet.br", follow_redirects=True)
            print(f"    ✓ Site acessível (status: {response.status_code})")
    except Exception as e:
        print(f"    ✗ Site INACESSÍVEL: {type(e).__name__}: {e}")
        return
    
    # 4. Testar API com autenticação
    print(f"\n[4] TESTANDO API (data: {datetime.now().strftime('%Y-%m-%d')})...")
    
    filter_dict = {
        "line": 1, 
        "periodTypeId": 1, 
        "tradingTypeId": 2, 
        "marketId": 3,
        "date": datetime.now().strftime("%Y-%m-%d")
    }
    
    params = {
        "page": 1,
        "filter": json.dumps(filter_dict, separators=(',', ':')),
        "start": 0, 
        "limit": 10,
        "sort": '[{"property":"created_at","direction":"desc"}]',
        "requiredDictionaries[]": ["LeagueGroup", "TimeZone"],
        "init": "true",
        "version": 0,
        "uniqAppId": APP_ID,
        "locale": "pt"
    }
    
    headers = {
        "accept": "application/json, text/plain, */*",
        "authorization": f"Bearer {token}",
        "referer": "https://tradeball.betbra.bet.br/dballTradingFeed",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0, cookies=cookies) as client:
            response = await client.get(API_BASE, headers=headers, params=params)
            
            print(f"    Status HTTP: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    matches = data.get("init", [])
                    print(f"    ✓ SUCESSO! {len(matches)} jogos encontrados")
                    
                    if matches:
                        m = matches[0]
                        print(f"\n    Exemplo de jogo:")
                        print(f"       Liga: {m.get('clName', 'N/A')}")
                        print(f"       Partida: {m.get('cthName', 'N/A')} vs {m.get('ctaName', 'N/A')}")
                        print(f"       Odds: {m.get('wldHm', 'N/A')} / {m.get('wldDm', 'N/A')} / {m.get('wldAm', 'N/A')}")
                        print(f"       Data: {m.get('dg', 'N/A')}")
                    else:
                        print("    ⚠ API retornou 200, mas sem jogos hoje")
                        print(f"    Chaves na resposta: {list(data.keys())}")
                except json.JSONDecodeError:
                    print(f"    ✗ Resposta não é JSON válido")
                    print(f"    Body: {response.text[:300]}")
                    
            elif response.status_code == 401:
                print("    ✗ ERRO 401 - TOKEN EXPIRADO!")
                print("\n    SOLUÇÃO:")
                print("    1. Faça login em https://tradeball.betbra.bet.br")
                print("    2. Abra DevTools (F12) > Network")
                print("    3. Filtre por 'feedDball' e recarregue")
                print("    4. Copie o header 'Authorization: Bearer <TOKEN>'")
                print("    5. Atualize TRADEBALL_AUTH_TOKEN no .env")
                
            elif response.status_code == 403:
                print("    ✗ ERRO 403 - COOKIES INVÁLIDOS OU SESSÃO EXPIRADA!")
                print("\n    SOLUÇÃO:")
                print("    1. Faça login em https://tradeball.betbra.bet.br")
                print("    2. Abra DevTools (F12) > Application > Cookies")
                print("    3. Copie todos os cookies (ou o header Cookie)")
                print("    4. Atualize TRADEBALL_COOKIES no .env")
                
            else:
                print(f"    ✗ ERRO INESPERADO: {response.status_code}")
                print(f"    Headers: {dict(response.headers)}")
                print(f"    Body: {response.text[:500]}")
                
    except httpx.TimeoutException:
        print("    ✗ TIMEOUT - API não respondeu em 30 segundos")
        print("    Possíveis causas: bloqueio de IP, rate limiting, ou servidor fora do ar")
    except httpx.ConnectError as e:
        print(f"    ✗ ERRO DE CONEXÃO: {e}")
    except Exception as e:
        print(f"    ✗ EXCEÇÃO: {type(e).__name__}: {e}")
    
    # 5. Resumo
    print("\n" + "=" * 60)
    print("RESUMO:")
    print("  Se status 200: Scraper deve funcionar normalmente")
    print("  Se status 401: Renovar token (ver instruções acima)")
    print("  Se status 403: Renovar cookies (ver instruções acima)")
    print("  Se timeout/erro: Verificar conectividade ou bloqueio")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(diagnose())
