

# Trocar Autenticacao para o Supabase Externo

## Resumo

Vamos apontar o login e todos os dados do sistema para o seu Supabase externo (`cjlsctsvzedrjzpcuire`), usando a nova chave que voce forneceu. Tambem vamos adaptar o sistema de permissoes para ler a tabela `user_permissions` do seu banco externo (que usa `user_email` e colunas `can_view_*`).

## O que muda

| Item | Antes | Depois |
|------|-------|--------|
| Login/Auth | Tentando usar Lovable Cloud (403) | Supabase externo com seus usuarios |
| Dados (odds, times, etc.) | Supabase externo | Supabase externo (sem mudanca) |
| Permissoes | Tabela `user_page_access` (user_id + page_key) | Tabela `user_permissions` (user_email + can_view_*) |

## Arquivos a alterar

### 1. `src/lib/supabase.ts`
- Apontar diretamente para o projeto externo `cjlsctsvzedrjzpcuire` com a chave `sb_publishable_zZhAHFCjDF5zj3xFWIBJDw_GWigFnZh`
- Nao depender mais das variaveis de ambiente auto-gerenciadas do Lovable Cloud

### 2. `src/types/auth.ts`
- Atualizar a interface `UserPermission` para refletir a estrutura da tabela `user_permissions` do banco externo (colunas `can_view_dashboard`, `can_view_sharkodds`, etc.)
- Atualizar o mapeamento `PAGE_KEYS` para corresponder as colunas da tabela

### 3. `src/contexts/AuthContext.tsx`
- Trocar a query de `user_page_access` por `user_permissions`
- Buscar permissoes por `user_email` (email do usuario logado) em vez de `user_id`
- Adaptar `canViewPage()` para ler as colunas `can_view_*` diretamente

### 4. `src/hooks/useUserManagement.ts`
- Adaptar para ler/escrever na tabela `user_permissions` do banco externo
- Usar `user_email` como chave em vez de `user_id`

### 5. `src/pages/admin/Users.tsx`
- Ajustar a interface de gerenciamento para trabalhar com a nova estrutura de permissoes

## Mapeamento de permissoes

```text
Coluna no banco externo        ->  PageKey no sistema
can_view_dashboard              ->  dashboard
can_view_payment_control        ->  subscriptions
can_view_procedure_control      ->  procedure_control
can_view_freebet_calculator     ->  (novo: freebet_calculator)
can_view_admin                  ->  admin_users / admin_logs
can_view_sharkodds              ->  (acesso geral ao sistema de odds)
can_view_conta_corrente         ->  (novo: conta_corrente)
can_view_shark_premium          ->  (novo: shark_premium)
can_view_plataformas            ->  (novo: plataformas)
can_view_betbra                 ->  betbra_affiliate
```

## Importante

- O sistema de aprovacao de usuarios (`user_profiles` com status pending/approved) sera mantido se existir no banco externo, ou simplificado para usar apenas a tabela `user_permissions`
- As tabelas de roles (`user_roles`) tambem precisam existir no banco externo para manter o controle de admin

