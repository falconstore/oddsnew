-- ============================================
-- ROW LEVEL SECURITY (RLS) - POLÍTICAS COMPLETAS
-- Execute este script no Supabase SQL Editor
-- ============================================

-- ============================================
-- FASE 1: SISTEMA DE ROLES
-- ============================================

-- 1.1 Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'scraper');

-- 1.2 Criar tabela de roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- 1.3 Criar função de verificação de role (SECURITY DEFINER - evita recursão)
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

-- 1.4 Função helper para verificar admin OU scraper
CREATE OR REPLACE FUNCTION public.is_admin_or_scraper(_user_id UUID)
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
      AND role IN ('admin', 'scraper')
  )
$$;

-- ============================================
-- FASE 2: HABILITAR RLS EM TODAS AS TABELAS
-- ============================================

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odds_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FASE 3: POLÍTICAS DE LEITURA (SELECT)
-- Todas as tabelas são legíveis publicamente
-- ============================================

CREATE POLICY "Public read leagues" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Public read teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Public read team_aliases" ON public.team_aliases FOR SELECT USING (true);
CREATE POLICY "Public read bookmakers" ON public.bookmakers FOR SELECT USING (true);
CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Public read odds_history" ON public.odds_history FOR SELECT USING (true);
CREATE POLICY "Public read alerts" ON public.alerts FOR SELECT USING (true);
CREATE POLICY "Public read system_settings" ON public.system_settings FOR SELECT USING (true);

-- Roles: usuários podem ver seus próprios roles, admins veem todos
CREATE POLICY "Users can view own roles" ON public.user_roles 
    FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 4: POLÍTICAS DE ESCRITA - LEAGUES
-- Apenas admin pode modificar
-- ============================================

CREATE POLICY "Admin insert leagues" ON public.leagues 
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update leagues" ON public.leagues 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete leagues" ON public.leagues 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 5: POLÍTICAS DE ESCRITA - TEAMS
-- Apenas admin pode modificar
-- ============================================

CREATE POLICY "Admin insert teams" ON public.teams 
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update teams" ON public.teams 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete teams" ON public.teams 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 6: POLÍTICAS DE ESCRITA - TEAM_ALIASES
-- Admin ou Scraper podem inserir/atualizar, apenas Admin deleta
-- ============================================

CREATE POLICY "Admin/Scraper insert team_aliases" ON public.team_aliases 
    FOR INSERT WITH CHECK (public.is_admin_or_scraper(auth.uid()));
CREATE POLICY "Admin/Scraper update team_aliases" ON public.team_aliases 
    FOR UPDATE USING (public.is_admin_or_scraper(auth.uid()));
CREATE POLICY "Admin delete team_aliases" ON public.team_aliases 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 7: POLÍTICAS DE ESCRITA - BOOKMAKERS
-- Apenas admin pode modificar
-- ============================================

CREATE POLICY "Admin insert bookmakers" ON public.bookmakers 
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update bookmakers" ON public.bookmakers 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete bookmakers" ON public.bookmakers 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 8: POLÍTICAS DE ESCRITA - MATCHES
-- Admin ou Scraper podem inserir/atualizar, apenas Admin deleta
-- ============================================

CREATE POLICY "Admin/Scraper insert matches" ON public.matches 
    FOR INSERT WITH CHECK (public.is_admin_or_scraper(auth.uid()));
CREATE POLICY "Admin/Scraper update matches" ON public.matches 
    FOR UPDATE USING (public.is_admin_or_scraper(auth.uid()));
CREATE POLICY "Admin delete matches" ON public.matches 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 9: POLÍTICAS DE ESCRITA - ODDS_HISTORY
-- Admin ou Scraper podem inserir/atualizar (principal tabela do scraper)
-- ============================================

CREATE POLICY "Admin/Scraper insert odds_history" ON public.odds_history 
    FOR INSERT WITH CHECK (public.is_admin_or_scraper(auth.uid()));
CREATE POLICY "Admin/Scraper update odds_history" ON public.odds_history 
    FOR UPDATE USING (public.is_admin_or_scraper(auth.uid()));
CREATE POLICY "Admin delete odds_history" ON public.odds_history 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 10: POLÍTICAS DE ESCRITA - ALERTS
-- Admin ou Scraper podem inserir/atualizar
-- ============================================

CREATE POLICY "Admin/Scraper insert alerts" ON public.alerts 
    FOR INSERT WITH CHECK (public.is_admin_or_scraper(auth.uid()));
CREATE POLICY "Admin/Scraper update alerts" ON public.alerts 
    FOR UPDATE USING (public.is_admin_or_scraper(auth.uid()));
CREATE POLICY "Admin delete alerts" ON public.alerts 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 11: POLÍTICAS DE ESCRITA - SYSTEM_SETTINGS
-- Apenas admin pode modificar
-- ============================================

CREATE POLICY "Admin insert system_settings" ON public.system_settings 
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update system_settings" ON public.system_settings 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete system_settings" ON public.system_settings 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 12: POLÍTICAS DE ESCRITA - USER_ROLES
-- Apenas admin pode gerenciar roles
-- ============================================

CREATE POLICY "Admin insert user_roles" ON public.user_roles 
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update user_roles" ON public.user_roles 
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete user_roles" ON public.user_roles 
    FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- FASE 13: CRIAR PRIMEIRO ADMIN (OPCIONAL)
-- Substitua 'SEU_USER_ID' pelo UUID do seu usuário
-- ============================================

-- Para encontrar seu user_id, vá em Authentication > Users no Supabase
-- INSERT INTO public.user_roles (user_id, role) VALUES ('SEU_USER_ID', 'admin');

-- ============================================
-- VERIFICAÇÃO: Listar todas as políticas criadas
-- ============================================

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public';
