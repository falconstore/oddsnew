-- Migration: Criar nova tabela user_page_access
-- Data: 2026-02-23
-- Motivo: Tabela user_permissions antiga usa user_id integer, incompatível com auth.users UUID

-- 1. Criar tabela
CREATE TABLE public.user_page_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    page_key TEXT NOT NULL,
    can_view BOOLEAN DEFAULT false NOT NULL,
    can_edit BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, page_key)
);

-- 2. Habilitar RLS
ALTER TABLE public.user_page_access ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS (usando função has_role existente para evitar recursão)

-- Usuários podem ver suas próprias permissões
CREATE POLICY "Users can view own page access"
ON public.user_page_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins podem ver todas as permissões
CREATE POLICY "Admins can view all page access"
ON public.user_page_access
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins podem inserir permissões
CREATE POLICY "Admins can insert page access"
ON public.user_page_access
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins podem atualizar permissões
CREATE POLICY "Admins can update page access"
ON public.user_page_access
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins podem deletar permissões
CREATE POLICY "Admins can delete page access"
ON public.user_page_access
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Índices para performance
CREATE INDEX idx_user_page_access_user_id ON public.user_page_access(user_id);
CREATE INDEX idx_user_page_access_page_key ON public.user_page_access(page_key);
