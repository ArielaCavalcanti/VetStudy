-- VetStudy: diagnóstico da importação do banco legado.
-- Execute após supabase/seed_review_pending.sql.

-- 1) Contagem por tipo e situação.
SELECT
  kind,
  review_status,
  COUNT(*)::int AS total
FROM public.questions
GROUP BY kind, review_status
ORDER BY kind, review_status;

-- 2) Quantas questões visuais antigas foram carregadas.
SELECT
  COUNT(*) FILTER (WHERE kind = 'image')::int AS questoes_visuais,
  COUNT(*) FILTER (WHERE kind = 'image' AND image_url IS NOT NULL)::int AS visuais_com_imagem,
  COUNT(*) FILTER (WHERE kind = 'image' AND image_url IS NULL)::int AS visuais_sem_imagem,
  COUNT(*) FILTER (WHERE kind = 'image' AND review_status = 'pending')::int AS visuais_pendentes
FROM public.questions;

-- 3) Conferir se há questões tradicionais repetidas por tópico/enunciado.
-- O índice UNIQUE da tabela impede repetições desse par.
SELECT topic_id, prompt, COUNT(*)::int AS total
FROM public.questions
GROUP BY topic_id, prompt
HAVING COUNT(*) > 1;

-- 4) Verifique as questões pendentes com suas disciplinas/tópicos.
SELECT
  q.kind,
  d.name AS disciplina,
  t.name AS topico,
  COUNT(*)::int AS total_pendentes
FROM public.questions q
JOIN public.topics t ON t.id = q.topic_id
JOIN public.disciplines d ON d.id = t.discipline_id
WHERE q.review_status = 'pending'
GROUP BY q.kind, d.name, t.name
ORDER BY d.sort_order, t.sort_order, q.kind;
