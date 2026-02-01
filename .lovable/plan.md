

# Corrigir Filtro de Casas para Extração de Freebet

## Problema Identificado

O filtro atual está excluindo casas **por nome**, mas isso está errado porque:

| Casa | Situação Atual | Situação Correta |
|------|----------------|------------------|
| Novibet | ❌ Excluída totalmente | ✅ Mostrar (tem PA e SO) |
| Aposta1 | ❌ Não aparece | ✅ Mostrar (é PA) |
| Tradeball | ❌ Aparece no filtro | ❌ Excluir (é SO) |
| Betbra | ✅ Excluída | ✅ Excluir (é SO) |
| Betnacional | ✅ Excluída | ✅ Excluir (é SO) |

## Causa Raiz

O código atual (linha 75-78 em `FreebetFilters.tsx`) exclui casas **pelo nome**:

```typescript
const paBookmakers = bookmakers.filter(b => {
  const name = b.name.toLowerCase();
  return !['novibet', 'betbra', 'betnacional'].some(so => name.includes(so));
});
```

Isso exclui a Novibet completamente, mesmo ela tendo odds PA.

## Solução

### 1. Atualizar lista de casas SO conhecidas

Em `src/lib/freebetUtils.ts`:

```typescript
// Casas que são EXCLUSIVAMENTE SO (nunca têm PA)
const KNOWN_SO_ONLY_BOOKMAKERS = ['betbra', 'betnacional', 'tradeball'];
```

### 2. Corrigir filtro no `FreebetFilters.tsx`

Ao invés de excluir por nome, excluir apenas casas que são **exclusivamente SO**:

```typescript
// Filtrar apenas casas que são exclusivamente SO
// Novibet tem PA e SO, então deve aparecer
const paBookmakers = bookmakers.filter(b => {
  const name = b.name.toLowerCase();
  // Excluir apenas casas que são exclusivamente SO
  return !['betbra', 'betnacional', 'tradeball'].some(so => name.includes(so));
});
```

### 3. Garantir que a lógica em `freebetUtils.ts` filtra corretamente

A função `getBestOddFromBookmaker` já filtra por `odds_type`:

```typescript
const bookmakerOdds = odds.filter(o => 
  o.bookmaker_name.toLowerCase().includes(bookmakerName.toLowerCase()) &&
  !isSOBookmaker(o.bookmaker_name, o.odds_type)  // ← Usa odds_type
);
```

Isso significa que mesmo se o usuário selecionar "Novibet", apenas as odds PA serão consideradas para a freebet.

## Arquivos a Modificar

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/lib/freebetUtils.ts` | 6 | Adicionar `tradeball` à lista de SO conhecidos |
| `src/components/freebet/FreebetFilters.tsx` | 75-78 | Excluir apenas casas exclusivamente SO (não Novibet) |

## Resultado Esperado

**Dropdown "Casa da Freebet"** mostrará:
- ✅ Bet365
- ✅ Betano
- ✅ Superbet
- ✅ Sportingbet
- ✅ KTO
- ✅ Esportivabet
- ✅ Aposta1 ← **Agora aparece**
- ✅ Novibet ← **Agora aparece (usará apenas odds PA)**
- ✅ McGames
- ✅ Br4bet
- ✅ Jogodeouro
- ✅ Stake
- ✅ Estrelabet
- ❌ Betbra (excluída - exclusivamente SO)
- ❌ Betnacional (excluída - exclusivamente SO)
- ❌ Tradeball (excluída - exclusivamente SO)

