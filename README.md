# VetStudy

Plataforma de estudos de anatomia veterinária, com interface React/TanStack Start, quizzes e persistência no Supabase.

## Estrutura

- `src/`: aplicação React, rotas, componentes, autenticação e lógica dos quizzes.
- `public/assets/`: figuras anatômicas usadas pela aplicação.
- `public/legacy/`: versão standalone anterior, preservada para consulta e recuperação.
- `drizzle/migrations/` e `supabase/`: estrutura e configuração do banco.

A branch `legacy-html-backup` preserva também o estado original do repositório antes da integração.

## Desenvolvimento local

Requer Node.js 22.12 ou superior.

```sh
npm install
npm run dev
```

## Variáveis do Supabase

Configure as variáveis no ambiente local (arquivo `.dev.vars`, não versionado) e no Cloudflare:

- `VITE_SUPABASE_URL`: URL pública do projeto Supabase, usada na compilação do cliente.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave publicável do Supabase, usada na compilação do cliente.
- `SUPABASE_URL`: URL do Supabase para o runtime do Worker.
- `SUPABASE_PUBLISHABLE_KEY`: chave publicável para operações no servidor.
- `SUPABASE_SERVICE_ROLE_KEY`: segredo de servidor para operações administrativas; nunca colocar no GitHub nem em variáveis `VITE_*`.

A autenticação por Google usa o OAuth do próprio Supabase; habilite Google em Authentication → Providers e configure as URLs de redirecionamento do domínio publicado.

## Cloudflare Workers

O projeto usa o plugin oficial `@cloudflare/vite-plugin` com TanStack Start.

```sh
npm run build
npm run preview
npm run deploy
```

No Cloudflare Workers Builds, conecte este repositório, use `npm run build` como comando de build e `npm run deploy` como comando de deploy. Configure as variáveis públicas no ambiente de build e os valores de runtime nos Settings → Variables and Secrets do Worker. Cadastre `SUPABASE_SERVICE_ROLE_KEY` como Secret, nunca como variável pública.

## Conteúdo legado

A versão anterior permanece disponível em `/legacy/index.html`, com seus arquivos de imagem em `/legacy/assets/`. Ela contém o banco anterior de questões e materiais. Esses dados ainda precisam ser importados e validados na estrutura atual do Supabase; a cópia preservada não significa que já estejam disponíveis nas novas telas.
