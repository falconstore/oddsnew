-- =============================================
-- Sistema de Roles para Autenticação
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =============================================

-- Criar enum para roles (se não existir)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'scraper', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar tabela de roles (se não existir)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função de verificação de role (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Política de leitura: usuário vê seus próprios roles, admin vê todos
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles 
    FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Políticas de escrita: apenas admin gerencia roles
DROP POLICY IF EXISTS "Admin insert user_roles" ON public.user_roles;
CREATE POLICY "Admin insert user_roles" ON public.user_roles 
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin update user_roles" ON public.user_roles;
CREATE POLICY "Admin update user_roles" ON public.user_roles 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin delete user_roles" ON public.user_roles;
CREATE POLICY "Admin delete user_roles" ON public.user_roles 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- IMPORTANTE: Após criar sua conta, execute:
-- =============================================
-- 1. Vá em Authentication > Users no Supabase Dashboard
-- 2. Copie o UUID do seu usuário
-- 3. Execute:
-- 
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('SEU_USER_ID_AQUI', 'admin');
-- =============================================
