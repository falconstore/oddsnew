
-- =====================================================
-- FIX: Recriar políticas RLS como PERMISSIVE
-- Tabelas: user_page_access, user_profiles, user_roles
-- =====================================================

-- 1. user_page_access
DROP POLICY IF EXISTS "Users can view own page access" ON public.user_page_access;
DROP POLICY IF EXISTS "Admins can view all page access" ON public.user_page_access;
DROP POLICY IF EXISTS "Admins can insert page access" ON public.user_page_access;
DROP POLICY IF EXISTS "Admins can update page access" ON public.user_page_access;
DROP POLICY IF EXISTS "Admins can delete page access" ON public.user_page_access;

CREATE POLICY "Users can view own page access"
ON public.user_page_access AS PERMISSIVE FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all page access"
ON public.user_page_access AS PERMISSIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert page access"
ON public.user_page_access AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update page access"
ON public.user_page_access AS PERMISSIVE FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete page access"
ON public.user_page_access AS PERMISSIVE FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.user_profiles;

CREATE POLICY "Users can view own profile"
ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own profile"
ON public.user_profiles AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
ON public.user_profiles AS PERMISSIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
