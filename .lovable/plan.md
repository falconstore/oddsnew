

# Atualizar Anon Key do Supabase Externo

## Problema

A chave atual `sb_publishable_zZhAHFCjDF5zj3xFWIBJDw_GWigFnZh` nao e uma anon key valida do Supabase, causando erro 401 no login.

## Solucao

Substituir a chave em `src/lib/supabase.ts` pela anon key correta fornecida:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzcHN1ZW1wbnN3bGprcGhhdHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTc1NTEsImV4cCI6MjA3NTkzMzU1MX0.zgEcoHFulNHrSxyHOZTbCCtDKfqjppHLRh1junsmsoA
```

**Observacao importante:** Esta chave contem o ref `wspsuempnswljkphathur`, que e diferente do URL atual (`cjlsctsvzedrjzpcuire`). O ref na chave precisa corresponder ao projeto. Vou atualizar o URL tambem para `https://wspsuempnswljkphathur.supabase.co` para que tudo fique consistente.

## Arquivo a alterar

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/supabase.ts` | Atualizar `supabaseUrl` para `https://wspsuempnswljkphathur.supabase.co` e `supabaseAnonKey` para a chave JWT fornecida |

## Impacto

- Login vai funcionar corretamente
- Todas as queries de dados (odds, permissoes, etc.) vao apontar para o projeto correto

