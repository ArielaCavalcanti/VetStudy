CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

ALTER TABLE public.questions ADD COLUMN review_status text NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending','approved','rejected'));
ALTER TABLE public.questions ADD COLUMN reviewer_note text;
ALTER TABLE public.questions ADD CONSTRAINT questions_topic_prompt_unique UNIQUE (topic_id, prompt);

DROP POLICY "public read questions" ON public.questions;
CREATE POLICY "public read approved questions" ON public.questions FOR SELECT TO anon, authenticated USING (review_status = 'approved');
CREATE POLICY "admins read all questions" ON public.questions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.questions, public.topics, public.disciplines TO authenticated;
CREATE POLICY "admins write questions" ON public.questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write topics" ON public.topics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write disciplines" ON public.disciplines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.quiz_attempts ADD COLUMN discipline_id uuid REFERENCES public.disciplines(id) ON DELETE SET NULL;