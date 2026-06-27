-- ============================================================================
-- procedure_drafts — rascunhos de procedimentos montados na aba "Envio de
-- Procedimentos" que passam por um fluxo de REVISÃO antes do disparo.
--
-- Fluxo:
--   1. Usuário A monta o procedimento e clica "Enviar para Revisão"
--      → cria um draft com status = 'pendente'. Imagens (já com marca d'água)
--        são subidas pro bucket procedure-images em drafts/{id}/...
--   2. Usuário B (revisor) abre a aba "Revisão Procedimentos", confere o texto
--      e dá zoom nas imagens.
--      → "Liberar"  => status = 'aprovado'  (habilita o disparo)
--      → "Rejeitar" => status = 'rejeitado' + reject_reason (volta pro montador)
--   3. Com status = 'aprovado', alguém clica "Enviar no grupo" → dispara a
--      sequência no Telegram → status = 'enviado', sent_at preenchido.
--
-- NÃO altera a tabela `procedures` (histórico real, populado pelo bot). É uma
-- tabela dedicada ao pipeline de envio/revisão.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.procedure_drafts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Estado no pipeline de revisão.
  status           text NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'enviado')),

  -- Conteúdo do procedimento.
  template_id      text,                 -- id do template usado (ou null se manual)
  texto            text NOT NULL,        -- texto final do procedimento
  entradas         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{casa,odd,aposte,link,observacao,freebet,image_path}]
  calc             jsonb,                -- {image_path, link} | null

  -- Autoria.
  created_by_email text,                 -- quem montou (useAuth().user.email)
  created_by_id    uuid,                 -- quem montou (useAuth().user.id)

  -- Revisão.
  reviewed_by_email text,               -- quem liberou/rejeitou
  reviewed_at      timestamptz,
  reject_reason    text,                 -- motivo, quando rejeitado

  -- Disparo.
  sent_at          timestamptz,         -- quando foi efetivamente enviado no grupo

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Fila de revisão: pendentes mais antigos primeiro.
CREATE INDEX IF NOT EXISTS idx_procedure_drafts_status_created
  ON public.procedure_drafts (status, created_at);

-- "Meus rascunhos": por autor, mais recentes primeiro.
CREATE INDEX IF NOT EXISTS idx_procedure_drafts_creator
  ON public.procedure_drafts (created_by_email, created_at DESC);

-- updated_at automático.
CREATE OR REPLACE FUNCTION public.procedure_drafts_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_procedure_drafts_updated_at ON public.procedure_drafts;
CREATE TRIGGER trg_procedure_drafts_updated_at
  BEFORE UPDATE ON public.procedure_drafts
  FOR EACH ROW EXECUTE FUNCTION public.procedure_drafts_touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS. Os writes acontecem via Edge Function (service_role), que ignora RLS.
-- A leitura no frontend hoje usa a chave service_role do cliente "procedures",
-- então liberamos SELECT pra authenticated/anon (o gating real é por aba no
-- frontend). Mantemos a tabela com RLS habilitado por higiene.
-- ----------------------------------------------------------------------------
ALTER TABLE public.procedure_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'procedure_drafts'
      AND policyname = 'procedure_drafts read all'
  ) THEN
    CREATE POLICY "procedure_drafts read all"
      ON public.procedure_drafts FOR SELECT
      USING (true);
  END IF;
END $$;
