-- VetStudy: biblioteca de materiais, resumos e geração de quizzes por IA.
-- Execute no SQL Editor do MESMO projeto Supabase usado pelo app.
-- Esta migração não altera nem remove as 250 questões já importadas.

BEGIN;

CREATE TABLE IF NOT EXISTS public.study_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),
  discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE RESTRICT,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_documents_topic_created_idx
  ON public.study_documents(topic_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.study_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES public.study_documents(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE RESTRICT,
  title text NOT NULL,
  content_markdown text NOT NULL,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewer_note text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_summaries_status_created_idx
  ON public.study_summaries(review_status, created_at DESC);

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS study_document_id uuid
  REFERENCES public.study_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS questions_study_document_idx
  ON public.questions(study_document_id);

ALTER TABLE public.study_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_summaries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_documents TO authenticated;
GRANT SELECT ON public.study_summaries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.study_summaries TO authenticated;
GRANT UPDATE ON public.questions TO authenticated;

DROP POLICY IF EXISTS "Admins manage study documents" ON public.study_documents;
CREATE POLICY "Admins manage study documents"
  ON public.study_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Read approved summaries or admin" ON public.study_summaries;
CREATE POLICY "Read approved summaries or admin"
  ON public.study_summaries
  FOR SELECT TO anon, authenticated
  USING (
    review_status = 'approved'
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "Admins manage study summaries" ON public.study_summaries;
CREATE POLICY "Admins manage study summaries"
  ON public.study_summaries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bucket privado. O limite de 25 MB fica abaixo do limite por arquivo da Responses API.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'study-materials',
  'study-materials',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins upload study materials" ON storage.objects;
CREATE POLICY "Admins upload study materials"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'study-materials'
    AND public.has_role(auth.uid(), 'admin')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admins read study materials" ON storage.objects;
CREATE POLICY "Admins read study materials"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins update study materials" ON storage.objects;
CREATE POLICY "Admins update study materials"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    bucket_id = 'study-materials'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins delete study materials" ON storage.objects;
CREATE POLICY "Admins delete study materials"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND public.has_role(auth.uid(), 'admin')
  );

COMMIT;

-- Verificação: os números de registros existentes não devem mudar.
SELECT 'Documentos' AS cadastro, COUNT(*)::int AS quantidade FROM public.study_documents
UNION ALL
SELECT 'Resumos', COUNT(*)::int FROM public.study_summaries
UNION ALL
SELECT 'Questões ligadas a documentos', COUNT(*)::int FROM public.questions WHERE study_document_id IS NOT NULL;
