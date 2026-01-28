
# Plano: Corrigir Links de Superbet e Aposta1

## Problemas Identificados

### 1. Superbet (Futebol e Basquete)

**Causa:** O scraper `superbet_scraper.py` envia `event_id` no `extra_data` (linhas 261-264, 294-297), mas o frontend espera `superbet_event_id`.

```python
# Scraper atual (linhas 261-264)
extra_data={
    "event_id": str(event.get("eventId", "")),
    "match_id": str(event.get("matchId", ""))
}
```

```typescript
// Frontend espera (linha 97-98)
const eventId = extraData.superbet_event_id;
const leagueId = extraData.superbet_league_id;
```

### 2. Aposta1 (Basquete NBA)

**Causa:** O scraper `aposta1_nba_scraper.py` envia apenas `aposta1_event_id`, mas o frontend requer tambem `aposta1_champ_id` e `aposta1_category_id` para construir o link.

```python
# Scraper atual (linhas 273-277)
extra_data={
    "aposta1_event_id": str(event_id),
    "country": "eua",
    "sport_type": "basketball"
}
```

```typescript
// Frontend requer (linhas 241-244)
const eventId = extraData.aposta1_event_id;
const champId = extraData.aposta1_champ_id;     // FALTANDO
const categoryId = extraData.aposta1_category_id; // FALTANDO
if (eventId && champId && categoryId) { ... }
```

---

## Solucao: Atualizar Frontend para Aceitar os Campos Corretos

A solucao mais segura e fazer o frontend aceitar ambos os formatos de campo (`event_id` e `superbet_event_id`), e usar fallbacks para campos faltantes.

### Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/MatchDetails.tsx` | Atualizar funcao `generateBookmakerLink` |

---

## Correcoes Especificas

### 1. Superbet (linhas 96-111)

**Antes:**
```typescript
if (name.includes('superbet')) {
  const eventId = extraData.superbet_event_id;
  const leagueId = extraData.superbet_league_id;
  ...
}
```

**Depois:**
```typescript
if (name.includes('superbet')) {
  // Aceitar ambos: superbet_event_id ou event_id
  const eventId = extraData.superbet_event_id || extraData.event_id;
  const leagueId = extraData.superbet_league_id || extraData.tournament_id;
  const sportType = extraData.sport_type as string;
  
  if (eventId && homeTeam && awayTeam) {
    // Construir link normalmente
    ...
  }
}
```

### 2. Aposta1 NBA (linhas 239-246)

**Antes:**
```typescript
if (name.includes('aposta1')) {
  const eventId = extraData.aposta1_event_id;
  const champId = extraData.aposta1_champ_id;
  const categoryId = extraData.aposta1_category_id;
  if (eventId && champId && categoryId) {
    return `https://www.aposta1.bet.br/esportes#/sport/66/category/${categoryId}/championship/${champId}/event/${eventId}`;
  }
}
```

**Depois:**
```typescript
if (name.includes('aposta1')) {
  const eventId = extraData.aposta1_event_id;
  const champId = extraData.aposta1_champ_id;
  const categoryId = extraData.aposta1_category_id;
  const sportType = extraData.sport_type as string;
  
  // Link completo com champ e category (futebol)
  if (eventId && champId && categoryId) {
    const sportId = sportType === 'basketball' ? '67' : '66';
    return `https://www.aposta1.bet.br/esportes#/sport/${sportId}/category/${categoryId}/championship/${champId}/event/${eventId}`;
  }
  
  // Fallback: link direto para NBA (sem champ/category)
  if (eventId && sportType === 'basketball') {
    // NBA usa sportId=67
    return `https://www.aposta1.bet.br/esportes#/sport/67/event/${eventId}`;
  }
  
  // Fallback generico futebol
  if (eventId) {
    return `https://www.aposta1.bet.br/esportes#/sport/66/event/${eventId}`;
  }
}
```

---

## Resultado Esperado

| Bookmaker | Esporte | Status Atual | Status Apos Correcao |
|-----------|---------|--------------|----------------------|
| Superbet | Futebol | Link nao funciona | Link funcional |
| Superbet | Basquete | Link nao funciona | Link funcional |
| Aposta1 | Futebol | Funciona | Continua funcionando |
| Aposta1 | Basquete | Link nao funciona | Link funcional (fallback) |

---

## Implementacao

### Unica alteracao necessaria

Atualizar a funcao `generateBookmakerLink` em `src/pages/MatchDetails.tsx` (linhas 66-273) para:

1. **Superbet**: Aceitar `event_id` alem de `superbet_event_id`
2. **Aposta1**: Adicionar fallback para quando `champ_id` e `category_id` nao estao disponiveis

### Codigo Final

```typescript
// Superbet (atualizado)
if (name.includes('superbet')) {
  const eventId = extraData.superbet_event_id || extraData.event_id;
  const leagueId = extraData.superbet_league_id;
  const sportType = extraData.sport_type as string;
  
  if (eventId && homeTeam && awayTeam) {
    const homeSlug = homeTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const awaySlug = awayTeam.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sportPath = sportType === 'basketball' ? 'basquete' : 'futebol';
    let url = `https://superbet.bet.br/odds/${sportPath}/${homeSlug}-x-${awaySlug}-${eventId}/`;
    if (leagueId) {
      url += `?t=offer-prematch-${leagueId}&mdt=o`;
    }
    return url;
  }
}

// Aposta1 (atualizado)
if (name.includes('aposta1')) {
  const eventId = extraData.aposta1_event_id;
  const champId = extraData.aposta1_champ_id;
  const categoryId = extraData.aposta1_category_id;
  const sportType = extraData.sport_type as string;
  
  // Link completo (futebol com champ/category)
  if (eventId && champId && categoryId) {
    const sportId = sportType === 'basketball' ? '67' : '66';
    return `https://www.aposta1.bet.br/esportes#/sport/${sportId}/category/${categoryId}/championship/${champId}/event/${eventId}`;
  }
  
  // Fallback: link direto por event_id (NBA)
  if (eventId && sportType === 'basketball') {
    return `https://www.aposta1.bet.br/esportes#/sport/67/event/${eventId}`;
  }
  
  // Fallback: link direto generico (futebol sem metadata)
  if (eventId) {
    return `https://www.aposta1.bet.br/esportes#/sport/66/event/${eventId}`;
  }
}
```

---

## Beneficios

1. **Retrocompativel**: Aceita dados antigos e novos
2. **Fallback inteligente**: Gera links funcionais mesmo com dados incompletos
3. **Sem mudanca no scraper**: Nao requer deploy de alteracoes no backend
4. **Correcao imediata**: Funciona assim que o frontend for atualizado
