-- Função de leitura pontual: resolve o id do auth.users por email EXATO.
-- Usada pela Edge Function admin-users (reset de senha da equipe) pra achar o
-- usuário sem listar/paginar o auth.users inteiro (que é compartilhado com o
-- PWA). O(1), sem efeito colateral.
--
-- SECURITY DEFINER pra ler auth.users (o schema auth não é acessível ao
-- caller comum). Execução restrita ao service_role (a Edge Function).
create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = auth, public
as $$
  select id
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;
$$;

-- Só o service_role pode executar (a Edge Function usa service_role).
revoke all on function public.get_auth_user_id_by_email(text) from public;
revoke all on function public.get_auth_user_id_by_email(text) from anon;
revoke all on function public.get_auth_user_id_by_email(text) from authenticated;
grant execute on function public.get_auth_user_id_by_email(text) to service_role;
