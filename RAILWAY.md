# Deploy — Railway

Três serviços em um mesmo projeto Railway:

```
ivy (project)
├─ Postgres        ← plugin oficial Railway
├─ backend         ← repo /backend, Dockerfile
└─ frontend        ← repo /frontend, Dockerfile
```

## Pré-requisitos

- Conta Railway (https://railway.app)
- GitHub conectado ao Railway (ou Railway CLI: `npm i -g @railway/cli && railway login`)
- App Password do Gmail (se quiser email funcionando — ver `backend/.env.example`)

## Passo a passo

### 1. Criar projeto e Postgres

1. No dashboard Railway: **New Project** → **Provision PostgreSQL**.
2. Anote/preserve a env var **`DATABASE_URL`** que o plugin gera (ela já fica disponível para outros serviços do mesmo projeto via referência: `${{Postgres.DATABASE_URL}}`).

### 2. Criar service "backend"

1. Mesmo projeto → **+ New** → **GitHub Repo** (ou via CLI: `railway up` dentro de `/backend`).
2. Em **Settings → Service Source**, defina **Root Directory = `/backend`**.
3. Railway detecta o `Dockerfile` automaticamente.
4. Em **Variables**, configurar:

   | Variável             | Valor                                                                  |
   | -------------------- | ---------------------------------------------------------------------- |
   | `DATABASE_URL`       | `${{Postgres.DATABASE_URL}}` (referência ao plugin)                    |
   | `NODE_ENV`           | `production`                                                           |
   | `PORT`               | `3002`                                                                 |
   | `CORS_ORIGIN`        | `https://<frontend-domain>` — preencher após o passo 3                 |
   | `SMTP_HOST`          | `smtp.gmail.com`                                                       |
   | `SMTP_PORT`          | `587`                                                                  |
   | `SMTP_USER`          | seu email Gmail                                                        |
   | `SMTP_PASS`          | App Password do Gmail (16 chars, sem espaços)                          |
   | `LEAD_FROM_EMAIL`    | mesmo do `SMTP_USER` ou alias autorizado                               |
   | `LEAD_TO_EMAIL`      | destinatário do briefing (ex: `operacoes@ivy.com.br`)                  |

5. Em **Settings → Networking**, **Generate Domain** — anote a URL pública (`https://ivy-backend-production.up.railway.app` ou similar).

### 3. Criar service "frontend"

1. Mesmo projeto → **+ New** → **GitHub Repo** (mesmo repo, root diferente).
2. Em **Settings → Service Source**, defina **Root Directory = `/frontend`**.
3. Em **Settings → Build → Build Arguments**, adicionar:

   | Build Arg        | Valor                                                |
   | ---------------- | ---------------------------------------------------- |
   | `VITE_API_URL`   | URL do backend do passo 2 (sem barra no final)       |

4. Em **Networking**, **Generate Domain** — anote a URL pública.

### 4. Conectar os dois

Voltar no service backend e colocar **`CORS_ORIGIN`** = a URL pública do frontend (com `https://`). Reinicia o backend.

### 5. Verificar

- `GET https://<backend>/api/health` → `{ok:true,...}`
- Abrir o frontend, enviar um briefing pelo form
- Conferir log do backend (`railway logs` ou no dashboard) — deve gravar lead + tentar email

### 6. Custom domain (opcional)

Em cada service → **Settings → Networking → Custom Domain**:
- `ivy.com.br` → frontend
- `api.ivy.com.br` → backend (ou subdomínio à escolha)

Aí atualizar:
- Backend `CORS_ORIGIN` = `https://ivy.com.br`
- Frontend build arg `VITE_API_URL` = `https://api.ivy.com.br`
- Em `frontend/index.html` e `frontend/src/hooks/usePageMeta.ts` — trocar todos os `ivy.com.br` placeholder pelo domínio real (canonical, OG, sitemap, JSON-LD)
- Em `frontend/public/sitemap.xml` e `frontend/public/robots.txt` — mesmo

## Estrutura de arquivos relevantes

```
backend/
  Dockerfile             ← multi-stage Node 22 alpine
  .dockerignore
  migrations/001_leads.sql

frontend/
  Dockerfile             ← multi-stage Node build → nginx alpine
  .dockerignore
  nginx.conf.template    ← envsubst no boot (variable: ${PORT})
  src/lib/api.ts         ← lê VITE_API_URL no build
```

## Migrations em produção

O backend executa `runMigrations()` no boot (em `src/db.ts`). É idempotente — só roda migrations que ainda não estão registradas em `_schema_migrations`. Não precisa rodar nada manualmente.

## Custos esperados (Railway)

- Postgres plugin: shared CPU, ~$5/mês de mínimo
- Backend (Node, baixo tráfego): cabe no free tier de execução
- Frontend (nginx, estático): cabe no free tier

Para tráfego de LP de captação, $5–$10/mês total no Railway é realista.
