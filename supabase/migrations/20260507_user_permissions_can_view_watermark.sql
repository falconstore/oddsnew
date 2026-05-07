-- Adiciona coluna can_view_watermark à tabela user_permissions
-- Aplicar no projeto Supabase principal (hyccrhpvedvfnzhetxkz)
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_view_watermark boolean NOT NULL DEFAULT false;

-- Concede acesso aos super admins existentes
UPDATE public.user_permissions
SET can_view_watermark = true
WHERE is_super_admin = true OR can_view_admin = true;
