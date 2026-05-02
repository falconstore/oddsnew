-- Adiciona permissão dedicada pra página /lastlink-admin (Pagamentos Lastlink).
-- Antes ela compartilhava o `can_view_trial` com o /trial-admin no Sidebar,
-- e por isso não aparecia no painel de permissões. Agora é independente.
--
-- Backfill: quem já tem can_view_trial OU é super admin recebe acesso
-- automaticamente, pra não perder o que estava funcionando.

ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_view_lastlink boolean NOT NULL DEFAULT false;

UPDATE public.user_permissions
   SET can_view_lastlink = true
 WHERE can_view_lastlink = false
   AND (can_view_trial = true OR is_super_admin = true);
