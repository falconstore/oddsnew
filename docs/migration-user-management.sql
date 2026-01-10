-- Migration: Sistema de Gerenciamento de Usuários
-- Criado em: 2026-01-10
-- Descrição: Adiciona tabelas para perfis de usuário, permissões granulares e funções auxiliares

-- =====================================================
-- PARTE 1: Tipos Enum
-- =====================================================

-- Criar enum de status do usuário
DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar enum de roles (caso não exista)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'scraper', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PARTE 2: Tabela user_roles (se não existir)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PARTE 3: Função has_role (security definer)
-- =====================================================

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

-- =====================================================
-- PARTE 4: Tabela de Perfis de Usuário
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    status user_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.user_profiles;

-- Políticas de user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all profiles" ON public.user_profiles 
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own profile" ON public.user_profiles 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update profiles" ON public.user_profiles 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.user_profiles 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can delete profiles" ON public.user_profiles 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- PARTE 5: Tabela de Permissões por Página
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    page_key TEXT NOT NULL,
    can_access BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, page_key)
);

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop políticas existentes
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admin can view all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admin can insert permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admin can update permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admin can delete permissions" ON public.user_permissions;

-- Políticas de user_permissions
CREATE POLICY "Users can view own permissions" ON public.user_permissions 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all permissions" ON public.user_permissions 
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert permissions" ON public.user_permissions 
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update permissions" ON public.user_permissions 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete permissions" ON public.user_permissions 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- PARTE 6: Políticas para user_roles
-- =====================================================

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all roles" ON public.user_roles 
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert roles" ON public.user_roles 
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update roles" ON public.user_roles 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete roles" ON public.user_roles 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- PARTE 7: Funções Auxiliares
-- =====================================================

-- Função para verificar se usuário pode acessar uma página
CREATE OR REPLACE FUNCTION public.can_access_page(_user_id UUID, _page_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT can_access FROM public.user_permissions 
     WHERE user_id = _user_id AND page_key = _page_key),
    false
  )
$$;

-- Função para verificar se usuário está aprovado
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = _user_id AND status = 'approved'
  )
$$;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at em user_profiles
DROP TRIGGER IF EXISTS set_updated_at ON public.user_profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- PARTE 8: Índices para Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_page_key ON public.user_permissions(page_key);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
