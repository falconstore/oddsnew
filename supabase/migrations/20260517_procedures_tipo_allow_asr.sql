-- =====================================================
-- Adiciona 'ASR' (Aposta Sem Risco) ao CHECK de procedures.tipo
--
-- Contexto: o parser do bot do Telegram (web + edge) já classifica
-- mensagens com LUCRO + RECOMPENSA EM FREEBET como tipo 'ASR', mas o
-- CHECK constraint atual só aceita SEM_FB/GANHAR_FB/QUEIMAR_FB. Resultado:
-- procedimentos de "Aposta Protegida com Aposta Grátis" são rejeitados no
-- INSERT e nunca chegam na lista (ficam só no bot_logs).
-- =====================================================

ALTER TABLE public.procedures DROP CONSTRAINT IF EXISTS procedures_tipo_check;
ALTER TABLE public.procedures
  ADD CONSTRAINT procedures_tipo_check
  CHECK (tipo = ANY (ARRAY['SEM_FB'::text, 'GANHAR_FB'::text, 'QUEIMAR_FB'::text, 'ASR'::text]));
