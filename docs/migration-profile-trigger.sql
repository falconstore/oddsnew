-- Migration: Criar trigger para auto-criação de perfil no signup
-- Este trigger cria automaticamente o perfil do usuário quando ele se cadastra

-- Criar função que será chamada pelo trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, phone, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Sem nome'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'pending'::user_status
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Criar trigger para executar após inserção em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Remover política antiga de INSERT
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Criar política que permite INSERT apenas via trigger (SECURITY DEFINER ignora RLS)
-- Esta política permite que usuários autenticados insiram seu próprio perfil como fallback
CREATE POLICY "Users can insert own profile" ON public.user_profiles 
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
