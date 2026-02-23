

# Corrigir Politicas RLS e Acesso ao Sistema

## Problema 1: Auth retornando 403

O erro `403` no endpoint `/auth/v1/token` indica que o projeto externo pode estar pausado ou com problemas de conexao. Voce precisa verificar diretamente no dashboard do Supabase externo se o projeto `cjlsctsvzedrjzpcuire` esta ativo e funcionando.

**Acao necessaria do usuario:** Acessar o dashboard do Supabase externo e verificar o status do projeto.

## Problema 2: Politicas RLS todas RESTRICTIVE

Todas as 5 politicas RLS da tabela `user_page_access` estao configuradas como RESTRICTIVE (Permissive: No). Com politicas restrictive, **TODAS** precisam ser verdadeiras ao mesmo tempo. Resultado:

- Um usuario comum precisa que `user_id = auth.uid()` E `has_role(admin)` sejam verdadeiros simultaneamente - impossivel para nao-admins
- Admins precisam que `has_role(admin)` E `user_id = auth.uid()` sejam verdadeiros - so funciona para linhas do proprio admin

### Correcao

Recriar as politicas como PERMISSIVE (o padrao do Postgres), onde basta UMA ser verdadeira:

```text
SQL a executar:
1. DROP todas as 5 policies existentes
2. Recriar como PERMISSIVE:
   - SELECT: users veem suas proprias linhas OU admins veem todas
   - INSERT: apenas admins
   - UPDATE: apenas admins
   - DELETE: apenas admins
```

### Mesma correcao para user_profiles e user_roles

As tabelas `user_profiles` e `user_roles` tambem tem policies RESTRICTIVE, o que pode causar o mesmo problema de acesso. Elas tambem serao corrigidas.

## Implementacao

| Passo | Acao |
|-------|------|
| 1 | Executar migration SQL para recriar as politicas RLS como PERMISSIVE nas 3 tabelas |
| 2 | Nenhuma alteracao de codigo necessaria - so as policies do banco |

## Apos a implementacao

- Verificar se o projeto externo esta ativo (resolver o 403)
- Testar login e acesso as paginas com um usuario nao-admin aprovado

