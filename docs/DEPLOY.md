# Fala Neto — Pôr a API e a web online (Railway)

> Um Dockerfile por serviço e `.dockerignore` na raiz. **Sem `railway.json`:** o "Config as Code" da Railway foi descontinuado (serviços novos já não o podem usar). Cada serviço escolhe o seu Dockerfile pela variável `RAILWAY_DOCKERFILE_PATH`.
>
> | Serviço | `RAILWAY_DOCKERFILE_PATH` | Porta do domínio | Health check |
> |---|---|---|---|
> | API (NestJS) | `apps/api/Dockerfile` | 8080 | `/api/v1/health` |
> | Web (app + painel) | `apps/admin/Dockerfile` | 8080 | `/privacy` |
>
> A Railway define `PORT=8080`; o domínio público tem de apontar para essa porta.
> Plano geral e ambientes: `docs/BACKEND.md` (secções 2–4).

## 0. Em produção (desde 2026-10-14)

| Serviço | Endereço |
|---|---|
| Web (app + painel em `/admin`) | https://stpadmin-production.up.railway.app |
| API | https://stpapi-production.up.railway.app/api/v1/health |

O nome `stpadmin` vem da pasta `apps/admin`; o site é a app completa. **Ao mudar o domínio da web**, atualizar na API `CORS_ORIGINS` e `CLERK_AUTHORIZED_PARTIES` — sem isso o login falha.

## 1. Como funciona

- A Railway constrói a imagem com o Dockerfile indicado em `RAILWAY_DOCKERFILE_PATH` (a partir da raiz do monorepo).
- Ao arrancar, o contentor corre `prisma migrate deploy` (aplica só migrações pendentes) e depois `node dist/main.js`.
  Se uma migração falhar, a API **não** arranca — a versão anterior continua no ar.
- Com o health check configurado (Settings → Deploy → Healthcheck Path), a Railway só troca para a nova versão quando ele responde 200.
- Deploy automático em cada push para `main` (opcional: Settings → Build → Watch Paths, ex.: `apps/api/**`, `packages/**`, `pnpm-lock.yaml`).
- A Arena (Socket.IO) guarda as salas em memória (ADR-08): usar **1 réplica** por serviço.

## 2. Passos na Railway (uma vez)

1. **New Project → Deploy from GitHub repo** → `anderson-fullstack-developer/app_stp`.
2. Em **Settings** do serviço:
   - Root directory: vazio (raiz do repositório — o Dockerfile precisa do monorepo).
   - Apagar o Build/Start Command que a Railway sugere (o Dockerfile já os define).
   - Região: UE (Amesterdão), perto do Neon.
   - Réplicas: **1**.
3. Em **Variables**, colar as variáveis da secção 3 e `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`.
4. Em **Networking → Generate Domain**, porta **8080** (ou domínio próprio, ex.: `api.falaneto.app`).
5. Abrir `https://<domínio>/api/v1/health` → deve dizer `ok`.
6. Repetir para staging (`stp-api-staging`) com a base de dados/branch Neon de staging.

## 3. Variáveis de ambiente

Os valores **nunca** vão para o repositório — só para o painel da Railway.

| Variável | Valor em produção | Notas |
|---|---|---|
| `NODE_ENV` | `production` | Torna obrigatórias as variáveis marcadas abaixo |
| `PORT` | (não definir) | A Railway define 8080 |
| `RAILWAY_DOCKERFILE_PATH` | `apps/api/Dockerfile` | Diz à Railway que Dockerfile usar |
| `DATABASE_URL` | Neon, host **com** `-pooler`, `?sslmode=verify-full` | **Obrigatória** |
| `DIRECT_URL` | Neon, host **sem** `-pooler`, `?sslmode=require` | Usada pelas migrações |
| `CLERK_SECRET_KEY` | `sk_live_…` (instância de produção do Clerk) | **Obrigatória** |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_…` | **Obrigatória** — ver secção 4 |
| `CLERK_AUTHORIZED_PARTIES` | URL(s) da web, ex.: `https://falaneto.app` | Separadas por vírgula |
| `CORS_ORIGINS` | URL(s) da web, ex.: `https://falaneto.app` | A app Android não precisa de CORS |
| `RATE_LIMIT_PER_MINUTE` | `120` | Opcional |
| `LOG_LEVEL` | `info` | Opcional |
| `SENTRY_DSN` | — | Opcional, quando houver Sentry |
| `APP_VERSION` | ex.: `1.0.0` | Opcional, aparece no `/health` |
| `PUBLIC_API_URL` | URL pública da API, ex.: `https://stpapi-production.up.railway.app` | Links dos áudios gravados na app |
| `AUDIO_STORAGE` | (não definir por agora) | Gravações de pronúncia: `none` por omissão em produção (o disco da Railway apaga-se a cada deploy). Cloudflare R2 a seguir |

## 3b. Serviço da web

No **mesmo projeto** da Railway: **New → GitHub Repo** (o mesmo repositório) e, em **Settings**:

- Root directory: vazio. Sem Build/Start Command.
- Domínio: o principal, ex.: `falaneto.app` (porta 8080).
- Health check: `/privacy` (página pública, sem sessão).

**Variáveis** (as `VITE_*` são públicas e entram no JavaScript do browser: a Railway passa-as à build; se mudarem, é preciso novo deploy):

| Variável | Valor | Quando é usada |
|---|---|---|
| `VITE_API_URL` | URL da API, ex.: `https://api.falaneto.app` (sem `/api/v1`) | build |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_…` | build e execução |
| `CLERK_SECRET_KEY` | `sk_live_…` (o mesmo da API) | execução — **segredo** |
| `VITE_SOCKET_URL` | (não definir — usa a API) | build |
| `PORT` | (não definir) | a Railway define 8080 |
| `RAILWAY_DOCKERFILE_PATH` | `apps/admin/Dockerfile` | Diz à Railway que Dockerfile usar |

Depois de a web ter domínio, pôr esse domínio em `CORS_ORIGINS` e `CLERK_AUTHORIZED_PARTIES` **da API**, e no Clerk (produção) → **Domains**.

## 4. Webhook do Clerk

No painel do Clerk (produção) → **Webhooks → Add endpoint**:

- URL: `https://<domínio-da-api>/api/v1/webhooks/clerk`
- Eventos: `user.created`, `user.updated`, `user.deleted`
- Copiar o **Signing secret** para `CLERK_WEBHOOK_SIGNING_SECRET` na Railway.

## 5. Depois do deploy

- **App Android:** `EXPO_PUBLIC_API_URL` de produção no perfil `production` do `apps/mobile/eas.json`.
- **Conteúdo:** o seed (`pnpm --filter @stp/api db:seed`) corre-se à mão, uma vez, a partir do computador com a `DIRECT_URL` de produção — nunca no arranque do contentor.
- **Primeiro admin:** `pnpm --filter @stp/api exec tsx scripts/grant-role.ts <email> ADMIN`, com as variáveis de produção.

## 6. Testar a imagem localmente (opcional)

Com o Docker Desktop ligado, a partir da raiz:

```bash
docker build -f apps/api/Dockerfile -t fala-neto-api .
docker run --rm -p 3000:3000 --env-file apps/api/.env fala-neto-api
# noutra janela:
curl http://localhost:3000/api/v1/health

# web (as VITE_* entram na build)
docker build -f apps/admin/Dockerfile -t fala-neto-web --build-arg VITE_API_URL=http://localhost:3000 --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_... .
docker run --rm -p 8080:3000 -e CLERK_SECRET_KEY=sk_test_... -e VITE_CLERK_PUBLISHABLE_KEY=pk_test_... fala-neto-web
# abrir http://localhost:8080
```

## 7. Dados de demonstração para capturas (portfólio)

Nunca na produção. Numa **cópia** da base de dados (branch do Neon), para as palavras e lições serem as reais:

1. Neon → projeto → **Branches → Create branch** (a partir de `main`), por ex. `portfolio`. Copiar a *connection string* do branch.
2. Na pasta `apps/api`:
   ```bash
   # PowerShell: $env:PORTFOLIO_DATABASE_URL="postgres://…branch…"
   pnpm exec tsx scripts/seed-portfolio.ts --sim      # cria ~50 pessoas e 30 dias de atividade
   pnpm exec tsx scripts/seed-portfolio.ts --limpar   # apaga tudo o que o script criou
   ```
3. Para ver: correr a API apontada ao branch (`DATABASE_URL`/`DIRECT_URL` do branch) e abrir o painel.

O script recusa-se a correr se o endereço for o da produção, não inventa palavras (usa o conteúdo que já existe) e marca todas as contas com `@portfolio.invalid`. Nas capturas, indicar "dados de demonstração".
