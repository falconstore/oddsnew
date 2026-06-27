-- Bloco de PROMOÇÕES nos rascunhos (templates de promoção: ganhar_fb_promo,
-- ganhar_fb_missao, promo_range, aposta_protegida). Cada promoção tem imagem
-- (path no Storage), descrição, link e a linha de chamada. Até 3 por procedimento.
-- [{ image_path, descricao, link, chamada }]
ALTER TABLE public.procedure_drafts
  ADD COLUMN IF NOT EXISTS promocoes jsonb DEFAULT '[]'::jsonb;
