-- Paridade FULL com FreeBet PRO (doc 02 — kickoff_at + fixture_id, doc 01 — esporte + cenario_b_cash)
-- Aditiva. Todas as colunas nullable ou com default seguro.

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS kickoff_at      timestamptz,
  ADD COLUMN IF NOT EXISTS fixture_id      bigint,
  ADD COLUMN IF NOT EXISTS esporte         text NOT NULL DEFAULT 'futebol',
  ADD COLUMN IF NOT EXISTS cenario_b_cash  numeric;

-- Backfill kickoff_at a partir de data_partida + horario_partida (assume America/Sao_Paulo)
-- Idempotente: só preenche onde está NULL e ambos os campos legados existem.
UPDATE public.procedures
   SET kickoff_at = ((data_partida::text || ' ' || horario_partida::text)::timestamp
                     AT TIME ZONE 'America/Sao_Paulo')
 WHERE kickoff_at IS NULL
   AND data_partida   IS NOT NULL
   AND horario_partida IS NOT NULL;

-- Index pro caminho quente da aba "FreeBets Ganhas" (busca por kickoff e por fixture_id)
CREATE INDEX IF NOT EXISTS idx_procedures_kickoff_at
  ON public.procedures (kickoff_at) WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_procedures_fixture_id
  ON public.procedures (fixture_id) WHERE fixture_id IS NOT NULL;
