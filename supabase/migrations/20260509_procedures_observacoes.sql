-- Adiciona campo observacoes para notas opcionais do bot (ex: Opção 2 da Aposta Protegida)
ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS observacoes TEXT;
