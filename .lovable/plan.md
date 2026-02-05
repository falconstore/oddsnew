
# Plano: Migração da Casa Mãe de Betano para Superbet

## Resumo Executivo

A Superbet será a nova "casa mãe" do sistema, responsável por:
- Criar times novos no banco de dados
- Definir os nomes canônicos dos times
- Estabelecer as datas/horários das partidas (com correção de fuso)
- Outras casas farão matching com os times criados pela Superbet

---

## 1. Correção do Fuso Horário

### Problema Identificado

A API da Superbet retorna horários em **UTC** (20:00Z), mas o jogo real é às **17:00 no Brasil** (UTC-3).

**Causa**: O scraper atual salva o horário como está, sem conversão.

### Solução

Converter o horário de UTC para o fuso horário de Brasília (UTC-3) antes de salvar:

```text
Arquivo: docs/scraper/scrapers/superbet_scraper.py

Antes (linha ~227):
  match_date = datetime.fromisoformat(utc_date.replace("Z", "+00:00"))

Depois:
  from datetime import timedelta
  match_date_utc = datetime.fromisoformat(utc_date.replace("Z", "+00:00"))
  # Converter para horário de Brasília (UTC-3)
  match_date = match_date_utc - timedelta(hours=3)
```

**Nota**: Manter o datetime como UTC-aware para consistência no banco, apenas ajustando a hora exibida.

---

## 2. Alterar a Casa Mãe no Team Matcher

### Arquivo: `docs/scraper/team_matcher.py`

```text
Linha 55:
Antes:
  self.primary_bookmaker = "betano"

Depois:
  self.primary_bookmaker = "superbet"
```

### Impacto

| Antes | Depois |
|-------|--------|
| Betano cria times novos | Superbet cria times novos |
| Betano define nomes canônicos | Superbet define nomes canônicos |
| Betano usa método async `find_team_id` | Superbet usa método async `find_team_id` |
| Outras casas usam cache | Outras casas usam cache (sem mudança) |

---

## 3. Garantir que Superbet Execute Primeiro

### Arquivo: `docs/scraper/standalone/run_sequential.py`

O Superbet já está posicionado como primeiro scraper nas configurações atuais:

```python
# Linha 40-41
LIGHT_SCRAPERS = [
    "superbet",  # ← JÁ É O PRIMEIRO
    "novibet", 
    ...
]

# Linha 69-71
ALL_SCRAPERS_INTERLEAVED = [
    "superbet", "novibet", "kto",  # ← JÁ É O PRIMEIRO
    "betano",
    ...
]

# Linha 93-95
HYBRID_TRIPLETS = [
    ("superbet", "novibet", "betano"),  # ← SUPERBET NO PRIMEIRO TRIPLET
    ...
]
```

**Nenhuma alteração necessária** - a ordem já está correta.

---

## 4. Revisar Ligas Configuradas na Superbet

### Arquivo: `docs/scraper/scrapers/superbet_scraper.py`

As ligas atuais são:

| Liga | ID | Status |
|------|-----|--------|
| Premier League | 106 | ✓ OK |
| Serie A | 104 | ✓ OK |
| La Liga | 98 | ✓ OK |
| Bundesliga | 245 | ✓ OK |
| Ligue 1 | 100 | ✓ OK |
| Paulistão | 20934 | ✓ OK |
| FA Cup | 107 | ✓ OK |
| EFL Cup | 90 | ✓ OK |
| Copa do Rei | 26 | ✓ OK |
| Champions League | 80794 | ✓ OK |
| Liga Europa | 688 | ✓ OK |
| Liga da Conferência | 56652 | ✓ OK |
| Eredivisie | 256 | ✓ OK |
| Brasileirão A | 1698 | ✓ OK |
| Libertadores | 389 | ✓ OK |
| Carioca | 21132 | ✓ OK |
| Liga Portuguesa | 142 | ✓ OK |
| NBA | 164 | ✓ OK |

**Verificar**: Se precisar adicionar mais ligas, basta incluir no dicionário `FOOTBALL_LEAGUES`.

---

## 5. Criar Aliases para Times com Nomes Diferentes

### Problema Potencial

Algumas casas podem usar nomes diferentes da Superbet. Por exemplo:

| Superbet | Betano | Bet365 |
|----------|--------|--------|
| Celta Vigo | Celta de Vigo | RC Celta |
| Inter Milan | Internazionale | Inter |

### Solução

Após a migração, monitorar logs de `[DIAG] UNMATCHED` e usar o script de diagnóstico:

```bash
# Na VPS, após alguns ciclos:
python docs/scraper/diagnose_team.py "Celta de Vigo" --bookmaker betano --league "La Liga"
```

O script gera automaticamente o SQL para criar o alias.

---

## 6. Adicionar Campos Extras ao extra_data (Opcional)

Para suportar deep links no frontend, adicionar mais campos do Superbet:

```text
Arquivo: docs/scraper/scrapers/superbet_scraper.py

Linha ~265-268:
extra_data={
    "event_id": str(event.get("eventId", "")),
    "match_id": str(event.get("matchId", "")),
    # NOVO: campos para deep links
    "superbet_event_id": str(event.get("eventId", "")),
    "tournament_id": str(event.get("tournamentId", "")),
    "betradar_id": str(event.get("betradarId", "")),
}
```

---

## Resumo das Alterações

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `superbet_scraper.py` | Converter UTC para horário Brasil (UTC-3) | ALTA |
| `team_matcher.py` | Mudar `primary_bookmaker` de "betano" para "superbet" | ALTA |
| `superbet_scraper.py` | Adicionar campos extras para deep links | MÉDIA |
| `run_sequential.py` | Nenhuma - Superbet já é primeiro | - |

---

## Fluxo Após Migração

```text
CICLO DE SCRAPING
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. SUPERBET (Casa Mãe)                                     │
│     └─ Cria times novos se não existem                      │
│     └─ Define nomes canônicos                               │
│     └─ Salva matches com horário Brasil                     │
│                                                             │
│  2. OUTRAS CASAS (Betano, Bet365, KTO, etc.)                │
│     └─ Fazem matching via cache                             │
│     └─ Se não achar, logam [UNMATCHED]                      │
│     └─ NÃO criam times novos                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Times com nomes diferentes não são matcheados | Monitorar logs e criar aliases via `diagnose_team.py` |
| Superbet não traz uma liga específica | Adicionar liga ao `FOOTBALL_LEAGUES` com ID correto |
| Horário incorreto após conversão | Validar com jogos conhecidos antes de deploy |
| Cache desatualizado com times antigos | Reiniciar PM2 para recarregar caches |

---

## Pós-Migração (Checklist)

1. ☐ Atualizar código (2 arquivos)
2. ☐ Reiniciar scrapers: `pm2 restart all`
3. ☐ Monitorar logs por 2-3 ciclos
4. ☐ Verificar se horários estão corretos no frontend
5. ☐ Criar aliases para times não matcheados (se houver)
