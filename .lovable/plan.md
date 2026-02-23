

# Corrigir Typo na URL do Supabase

## Problema

O dominio `wspsuempnswljkphathur.supabase.co` nao existe (ERR_NAME_NOT_RESOLVED). O projeto real e `wspsuempnswljkphatur` (sem o 'h' antes de 'ur').

## Solucao

### 1. `src/lib/supabase.ts`
- Corrigir a URL de `wspsuempnswljkphathur` para `wspsuempnswljkphatur`
- Atualizar a anon key se necessario (a key atual tambem contem o ref errado)

```text
Antes:  https://wspsuempnswljkphathur.supabase.co
Depois: https://wspsuempnswljkphatur.supabase.co
```

## Importante

A anon key atual tambem precisa ser verificada, pois contem o ref `wspsuempnswljkphathur` no JWT. Se o login continuar falhando apos a correcao da URL, voce precisara fornecer a anon key correta do dashboard (Settings > API > anon public).

## Impacto

- Corrige o erro de DNS que impede qualquer comunicacao com o Supabase
- Login, dados e permissoes voltarao a funcionar
