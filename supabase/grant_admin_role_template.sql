-- Execute após criar sua conta no VetStudy e confirmar o usuário no Supabase.
-- Copie o UUID da sua conta em Supabase Dashboard > Authentication > Users.
-- Substitua o valor abaixo pelo UUID real. Não coloque e-mail ou senha aqui.
INSERT INTO public.user_roles (user_id, role)
VALUES ('COLE-SEU-UUID-AQUI'::uuid, 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;
