-- Tabela para registrar quais procedimentos o usuário marcou como realizados
CREATE TABLE IF NOT EXISTS public.user_procedure_checks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_email   text        NOT NULL,
  procedure_id uuid        NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  checked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_email, procedure_id)
);

ALTER TABLE public.user_procedure_checks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS user_procedure_checks_email_idx
  ON public.user_procedure_checks (lead_email, checked_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='user_procedure_checks' AND policyname='user_checks_select'
  ) THEN
    CREATE POLICY "user_checks_select" ON public.user_procedure_checks
      FOR SELECT USING (lead_email = (auth.jwt() ->> 'email'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='user_procedure_checks' AND policyname='user_checks_insert'
  ) THEN
    CREATE POLICY "user_checks_insert" ON public.user_procedure_checks
      FOR INSERT WITH CHECK (lead_email = (auth.jwt() ->> 'email'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='user_procedure_checks' AND policyname='user_checks_delete'
  ) THEN
    CREATE POLICY "user_checks_delete" ON public.user_procedure_checks
      FOR DELETE USING (lead_email = (auth.jwt() ->> 'email'));
  END IF;
END $$;
