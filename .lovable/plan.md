

# Corrigir Acesso Negado - Tabelas Inexistentes no Supabase Externo

## Problema

O login funciona (status 200), mas as tabelas `user_roles` e `user_profiles` nao existem no Supabase externo (retornam 404). Apenas a tabela `user_permissions` existe. Como o `AuthContext` depende de `user_profiles` para definir `isApproved`, o usuario fica com `isApproved = false` e ve "Acesso Negado".

## Diagnostico

```text
user_roles     -> 404 (nao existe)
user_profiles  -> 404 (nao existe)
user_permissions -> 200 (funciona, retorna can_view_admin: true)
```

## Solucao

Modificar o `AuthContext` (`src/contexts/AuthContext.tsx`) para derivar admin e aprovacao a partir dos dados de `user_permissions`:

1. Se a query de `user_roles` falhar (404), verificar `can_view_admin` em `user_permissions` para determinar se e admin
2. Se a query de `user_profiles` falhar (404), considerar o usuario como aprovado se ele tiver um registro em `user_permissions`
3. Tratar os erros 404 silenciosamente em vez de deixar o estado vazio

## Logica Atualizada

```text
Antes:
  isAdmin = tem registro em user_roles com role 'admin'
  isApproved = user_profiles.status === 'approved'

Depois:
  isAdmin = tem registro em user_roles com role 'admin' 
            OU user_permissions.can_view_admin === true (fallback)
  isApproved = user_profiles.status === 'approved' 
               OU existe registro em user_permissions (fallback)
```

## Arquivo a Alterar

| Arquivo | Mudanca |
|---------|---------|
| `src/contexts/AuthContext.tsx` | Adicionar fallback na funcao `loadUserData` para derivar admin/aprovacao de `user_permissions` quando `user_roles`/`user_profiles` nao existem |

## Impacto

- Usuario com registro em `user_permissions` sera considerado aprovado automaticamente
- Usuario com `can_view_admin: true` sera considerado admin mesmo sem tabela `user_roles`
- Compatibilidade total com o esquema existente do Supabase externo

