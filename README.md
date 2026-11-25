# VetStudy

Plataforma de estudos de anatomia veterinária, com interface React/TanStack Start, quizzes e persistência no Supabase.

## Estrutura

- `src/`: aplicação React, rotas, componentes, autenticação e lógica dos quizzes.
- `public/assets/`: figuras anatômicas usadas pelo aplicativo novo.
- `public/legacy/`: versão standalone anterior, preservada para consulta em `/legacy/index.html`.
- `supabase/seed_review_pending.sql`: importação idempotente do banco legado (240 questões tradicionais + 10 questões visuais).
- `supabase/grant_admin_role_template.sql`: modelo para dar acesso administrativo de revisão.
- `drizzle/migrations/` e `supabase/`: estrutura e configuração do banco.

A branch `legacy-html-backup` preserva o repositório anterior antes da integração. A branch `main` não foi substituída: a integração está isolada em `lovable-app-integration`.

## Desenvolvimento local

Requer Node.js 22.12 ou superior.

1. Copie `.env.example` para `.env` e preencha as duas variáveis públicas do Supabase.
2. Copie `.dev.vars.example` para `.dev.vars` e preencha as variáveis usadas pelo Worker local.
3. Instale e execute:

```sh
npm install
npm run dev
```

## Supabase

Variáveis públicas de build (podem ser expostas no bundle):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Variáveis de runtime do Worker:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — segredo apenas do servidor; nunca colocar no GitHub nem em variável `VITE_*`.

A autenticação por Google usa o OAuth do Supabase. Habilite Google em Authentication → Providers e configure os endereços de redirecionamento do domínio publicado.

### Banco de questões e revisão

O script `supabase/seed_review_pending.sql` insere as 250 questões do banco legado associando cada uma ao tópico pelo slug. Ele é seguro para reexecução: questões existentes são ignoradas. Todas entram com `review_status = 'pending'`, e a política RLS mantém essas questões invisíveis para estudantes até aprovação.

Durante a primeira importação automática via integração, 100 questões tradicionais foram inseridas como pendentes. A execução do SQL completo no Supabase SQL Editor completa as demais sem duplicar as já existentes.

A rota `/admin` oferece revisão e aprovação para contas com papel `admin`. Depois de criar sua conta de estudante, um administrador deve copiar seu UUID em Supabase Dashboard → Authentication → Users e executar o modelo `supabase/grant_admin_role_template.sql` após substituir `COLE-SEU-UUID-AQUI`.

## Cloudflare Workers

O projeto usa o plugin oficial `@cloudflare/vite-plugin` com TanStack Start.

```sh
npm run build
npm run preview
npm run deploy
```

No Cloudflare Workers Builds, conecte este repositório e selecione a branch `main` depois da revisão e merge desta branch. Use `npm run build` como comando de build e `npm run deploy` como comando de deploy. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` como variáveis do build. Cadastre `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no Worker e `SUPABASE_SERVICE_ROLE_KEY` como Secret.

Ainda não foi feito deploy nem uma compilação de produção validada. Não faça merge/publicação até o build e os testes passarem e as variáveis do Supabase estarem configuradas.

## Conteúdo legado

A versão standalone foi preservada em `/legacy/index.html`, com figuras em `/legacy/assets/`. Ela continua como arquivo de referência, não como página inicial do app novo. Os canais de materiais antigos também permanecem recuperáveis nessa cópia, mas a nova interface de resumos e uploads ainda precisa ser implementada.
