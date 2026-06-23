-- ============================================================================
-- Permissões por aba via coluna JSON (allowed_pages)
-- Rodar no projeto PRINCIPAL de auth (o do login / VITE_SUPABASE_URL).
--
-- O que faz:
--   1. Adiciona a coluna allowed_pages (jsonb) em user_permissions
--   2. Popula allowed_pages a partir das colunas legadas can_view_*  -> keys do
--      registro em src/config/pages.ts. Ninguém perde acesso.
--   3. As colunas can_view_* continuam existindo (legado) e podem ser
--      removidas no futuro, depois de validado.
--
-- Mapeamento coluna legada -> key(s) do registro:
--   can_view_dashboard          -> dashboard
--   can_view_procedure_control  -> procedure_control, freebets_ganhas
--   can_view_sharkodds          -> casas
--   can_view_payment_control    -> subscriptions
--   can_view_lastlink           -> lastlink_admin, lastlink_dashboard
--   can_view_betbra             -> betbra_affiliate
--   can_view_trial              -> trial, ads_admin
--   can_view_watermark          -> watermark
--   (app_stats / push_notifications não tinham coluna própria — começam ocultos,
--    libere manualmente a quem precisar.)
-- ============================================================================

-- 1) Coluna nova
alter table public.user_permissions
  add column if not exists allowed_pages jsonb not null default '[]'::jsonb;

-- 2) Backfill: monta o array de keys a partir das colunas legadas.
--    to_jsonb(array_remove(array[...], null)) -> array só com as keys liberadas.
update public.user_permissions up
set allowed_pages = to_jsonb(array_remove(array[
  case when up.can_view_dashboard         then 'dashboard'          end,
  case when up.can_view_procedure_control then 'procedure_control'  end,
  case when up.can_view_procedure_control then 'freebets_ganhas'    end,
  case when up.can_view_sharkodds         then 'casas'              end,
  case when up.can_view_payment_control   then 'subscriptions'      end,
  case when up.can_view_lastlink          then 'lastlink_admin'     end,
  case when up.can_view_lastlink          then 'lastlink_dashboard' end,
  case when up.can_view_betbra            then 'betbra_affiliate'   end,
  case when up.can_view_trial             then 'trial'              end,
  case when up.can_view_trial             then 'ads_admin'          end,
  case when up.can_view_watermark         then 'watermark'          end
]::text[], null))
-- só backfill em quem ainda está com o default vazio, pra ser idempotente
where up.allowed_pages = '[]'::jsonb;
