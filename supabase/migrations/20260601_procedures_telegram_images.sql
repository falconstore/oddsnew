-- Adiciona coluna de imagens do Telegram nos procedimentos
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS telegram_images text[] DEFAULT NULL;

-- Bucket público para imagens (criado via Management API)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('procedure-images', 'procedure-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
-- ON CONFLICT (id) DO NOTHING;

-- Policy: leitura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'procedure-images public read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "procedure-images public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'procedure-images');
    $pol$;
  END IF;
END $$;

-- Policy: service_role pode inserir/deletar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'procedure-images service insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "procedure-images service insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'procedure-images');
    $pol$;
  END IF;
END $$;
