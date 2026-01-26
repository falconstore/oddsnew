-- Migration: Atualizar sistema de permissões para can_view/can_edit
-- Data: 2026-01-26

-- 1. Adicionar novas colunas
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS can_view BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT false NOT NULL;

-- 2. Migrar dados existentes (can_access -> can_view e can_edit)
UPDATE public.user_permissions 
SET can_view = can_access, can_edit = can_access
WHERE can_access IS NOT NULL;

-- 3. Criar funções de verificação (Security Definer para evitar recursão RLS)
CREATE OR REPLACE FUNCTION public.can_view_page(_user_id UUID, _page_key TEXT)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT COALESCE(
    (SELECT can_view FROM public.user_permissions 
     WHERE user_id = _user_id AND page_key = _page_key),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_page(_user_id UUID, _page_key TEXT)
RETURNS BOOLEAN 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT COALESCE(
    (SELECT can_edit FROM public.user_permissions 
     WHERE user_id = _user_id AND page_key = _page_key),
    false
  )
$$;

-- 4. (Opcional) Remover coluna antiga após confirmar migração
-- ALTER TABLE public.user_permissions DROP COLUMN IF EXISTS can_access;

-- 5. Verificar estrutura
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'user_permissions';
