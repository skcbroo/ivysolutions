# IVY · Recuperação de Ativos

Site institucional + plataforma interna de inteligência patrimonial (OSINT) da IVY.

```
┌─────────────────────────────────────────────────────────┐
│  /            Landing pública (marketing, leads)        │
│  /sobre       Sobre a IVY                               │
│  /osint/*     Plataforma interna de analistas (JWT)     │
│               · Dossiês patrimoniais                    │
│               · Busca em fontes públicas (CNPJa, CNJ)   │
│               · Gestão de usuários (admin)              │
└─────────────────────────────────────────────────────────┘
```

## Stack

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 · Vite 6 · TypeScript · Tailwind 4 (tokens OKLCH) · React Router 7 · Three.js (LP) |
| **Backend** | Node 22 · Fastify 5 · TypeScript · Zod · `pg` raw |
| **DB** | PostgreSQL 16 (migrations SQL idempotentes) |
| **Auth** | JWT HS256 (12h) · bcryptjs · roles admin/analista |
| **Testes** | Vitest · Testing Library · happy-dom · axe-core · undici MockAgent |
| **Deploy** | Railway (Docker multi-stage; nginx + Fastify) |

160 testes passando (97 backend, 63 frontend) — ver [CI](.github/workflows/test.yml).

## Setup local

### Pré-requisitos

- Node 22+
- Docker (apenas para o Postgres local) — alternativamente um Postgres já rodando
- A primeira vez: `docker compose -f infra/docker-compose.yml up -d` sobe o Postgres em `localhost:5432`

### 1. Backend

```bash
cd backend
cp .env.example .env
# edite .env: defina ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET
npm install
npm run dev
```

Na primeira execução, o backend:
1. Aplica migrations em `backend/migrations/*.sql`
2. Roda `bootstrapAdmin()` — se `ADMIN_EMAIL`/`ADMIN_PASSWORD` estiverem setados e nenhum admin ativo existir, cria você como admin
3. Inicia em `http://localhost:3002`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite serve em `http://localhost:5173`. Proxy `/api/*` → `localhost:3002`.

### 3. Primeiro login

Acesse `http://localhost:5173/osint/login` com as credenciais que setou em `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Você será forçado a trocar a senha no primeiro acesso.

Pela aba **Usuários** (visível só para admins) você cria os demais analistas — eles entram com a senha padrão `ivy@2026` e trocam no primeiro login.

## Comandos

```bash
# Backend
npm run dev         # tsx watch + .env
npm run build       # tsc → dist/
npm run start       # node dist/server.js (prod)
npm run typecheck   # tsc --noEmit
npm test            # vitest run (precisa do Postgres up)
npm run test:watch  # vitest interativo

# Frontend
npm run dev         # vite
npm run build       # tsc + vite build (estático em dist/)
npm run preview     # vite preview
npm test            # vitest run
npm run test:watch  # vitest interativo
```

## Variáveis de ambiente (backend)

Ver [`backend/.env.example`](backend/.env.example) — todas validadas por Zod no boot.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | sim | 16+ chars. Em prod gere: `openssl rand -hex 32` |
| `JWT_TTL` | não | Default `12h`. Aceita ex: `7d`, `60m` |
| `ALLOW_REGISTRATION` | não | `true` libera `/auth/register` público. **Em prod deixe vazio.** |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | recomendado | Bootstrap do primeiro admin (idempotente) |
| `ADMIN_NOME` | não | Nome do admin no bootstrap. Default "Administrador" |
| `PORT` | não | Default 3001 |
| `CORS_ORIGIN` | não | Origin(s) permitidos no CORS, separados por vírgula |
| SMTP (`SMTP_*`, `LEAD_*`) | não | Notificação de leads. Sem SMTP, leads são apenas logados |

## Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  /  (LP)              /osint/*  (interno, JWT)                   │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS · /api/* via nginx proxy
┌────────────────────────▼─────────────────────────────────────────┐
│              BACKEND Fastify · porta 3002                        │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Routes → Repos → pg.Pool → PostgreSQL                    │   │
│  │  POST /api/investigacoes dispara runWorker(id) async      │   │
│  └───────────────────────────────────────────────────────────┘   │
│  ┌─ Worker assíncrono (mesmo processo) ──────────────────────┐   │
│  │  Block1: CPF → BFF CNPJa → BrasilAPI + CNPJa Open         │   │
│  │  Block2: DJEN/Comunica + scraping fallback                │   │
│  │  Report: gera markdown completo                           │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Fontes externas (todas públicas)

| Fonte | Endpoint | Usada para |
|---|---|---|
| BFF CNPJa | `bff.cnpja.com` | CPF → empresas (membership) |
| BrasilAPI | `brasilapi.com.br/cnpj/v1/` | Detalhe de CNPJ (QSA, capital) |
| CNPJa Open | `open.cnpja.com/office/` | E-mails e telefones formatados |
| DJEN CNJ | `comunicaapi.pje.jus.br` | Processos por nome/CPF/empresa |
| cnpj.biz | scraping | Fallback de CNPJ |

Throttling por API via `p-queue` (`apis/queue.ts`). Retry/backoff exponencial em 429/5xx (`apis/http.ts`).

### Camadas

```
backend/src/
├── app.ts                  factory Fastify (testável via inject)
├── server.ts               entrypoint: buildApp + migrations + bootstrap + listen
├── config.ts               Zod schema das envs (única fonte da verdade)
├── db.ts                   pg.Pool + runMigrations()
├── repos/                  ← Repository pattern: SQL isolado por domínio
│   ├── users.ts
│   ├── investigacoes.ts
│   ├── empresas.ts
│   ├── processos.ts
│   └── relatorios.ts
├── routes/                 handlers Fastify (validação Zod, sem SQL)
├── auth/                   hash, jwt, middleware, bootstrap, routes de /auth
├── apis/                   clientes HTTP de fontes externas
├── blocks/                 lógica de domínio (block1 = empresas, block2 = processos)
├── report/                 gerador do markdown
├── worker.ts               orquestrador Block1 → Block2 → relatório
└── utils/format.ts         formatCpf, formatCnpj, toDate (compartilhados)

frontend/src/
├── App.tsx                 router + RequireAuth/RequireAdmin guards
├── lib/osint.ts            session storage + osintApi (AbortSignal)
├── hooks/                  useVisibleInterval, useSortable
├── components/osint/       Button, Field, Layout, StatusBadge, ConfirmInline...
└── pages/osint/
    ├── Login.tsx
    ├── Lista.tsx
    ├── Nova.tsx
    ├── Perfil.tsx
    ├── AdminUsuarios.tsx
    └── Relatorio/          ← split em 10 arquivos
        ├── index.tsx       Relatorio page + re-exports
        ├── Tabs.tsx
        ├── TabEmpresas.tsx
        ├── TabProcessos.tsx
        ├── TabTimeline.tsx
        ├── TabRelatorio.tsx
        ├── RunningPanel.tsx
        ├── DossieProtocolo.tsx
        ├── format.ts
        └── shared.tsx
```

## Banco

10 migrations em `backend/migrations/` aplicadas em ordem alfabética. Tabelas:

| Tabela | Conteúdo |
|---|---|
| `users` | id, email, password_hash, role, active, must_change_password |
| `leads` | captação da LP pública |
| `investigacoes` | nome, cpf, status, progresso JSONB, capital_total, pje_count, warnings |
| `empresas` | dados RFB + emails/telefones (JSONB arrays) + qsa + alertas |
| `processos` | número, classe, tribunal, polo, criminal, vinculo, comunicacoes JSONB |
| `processos_advogados` | nome + OAB de cada advogado identificado |
| `processos_empresas_vinculadas` | PJs associadas no processo |
| `relatorios` | conteudo_md (markdown completo do dossiê) |
| `_schema_migrations` | controle de quais migrations já rodaram |

## Auth

```
1. POST /auth/login
   → backend valida bcrypt + active=true
   → retorna JWT (12h) + user info
   → frontend salva em localStorage (ivy_osint_token, ivy_osint_user)

2. Request autenticada: Authorization: Bearer <JWT>
   → requireAuth: decodifica + injeta request.user
   → requireAdmin: além disso, exige role='admin'

3. Se must_change_password=true: frontend redireciona pra /osint/perfil

4. Logout: clearSession() + redireciona pra /osint/login
```

Senha padrão (criada por admin OU reset): **`ivy@2026`** — usuário troca obrigatoriamente no primeiro login.

## Testes

### Backend (97 testes)

```bash
# pré-requisito: Postgres rodando
docker compose -f infra/docker-compose.yml up -d

cd backend
DATABASE_URL=postgres://admin:senha123@localhost:5432/ivysolutions \
JWT_SECRET=dev-jwt-secret-change-me-please-32ch \
ALLOW_REGISTRATION=true \
npm test
```

Cobertura:
- **Unit puros** (48): formatters, JWT, regex criminal, vínculo rank, classifyPolo, bcrypt
- **HTTP/E2E** (17): rotas via `fastify.inject()` + DB real (auth + investigacoes + users)
- **Integration MockAgent** (12): Block1 + Comunica/Block2 com APIs externas mockadas via undici
- **Worker E2E** (2): orquestração completa com DB real + APIs mockadas
- **HTTP retry/backoff** (5): 429×2 → 200 com backoff exponencial validado

### Frontend (63 testes)

```bash
cd frontend
npm test
```

Cobertura:
- **Component unit** (11): Field, StatusBadge, ConfirmInline
- **Hooks** (3+3): useVisibleInterval (Page Visibility), useSortable
- **Lib** (10): session storage, isAbortError, formatters
- **Integration** (20): Lista polling com mock, Tabs ARIA + keyboard nav, ContatoToggle, Login validação
- **Axe-core a11y** (5): scan WCAG 2.1 AA em componentes-chave
- **Responsive** (2): coexistência desktop/mobile no DOM

### CI

GitHub Actions em [`.github/workflows/test.yml`](.github/workflows/test.yml) roda backend (com Postgres service container) + frontend a cada push/PR.

## Deploy (Railway)

1. **Provisione Postgres** (plugin do Railway)
2. **Backend service** do `/backend` (Dockerfile multi-stage). Env vars necessárias:
   - `DATABASE_URL` (vem do plugin Postgres, ex: `${{Postgres.DATABASE_URL}}`)
   - `JWT_SECRET` (gere com `openssl rand -hex 32`)
   - `ADMIN_EMAIL` + `ADMIN_PASSWORD` (primeiro admin, bootstrap automático)
   - `CORS_ORIGIN` (domínio do frontend)
   - `NODE_ENV=production`
   - `ALLOW_REGISTRATION` vazio (sem registro público)
3. **Frontend service** do `/frontend` (nginx multi-stage)
4. Configure domínios + DNS

No primeiro deploy, o backend aplica migrations e cria seu admin automaticamente via `bootstrapAdmin()`.

## Limitações conhecidas (área OSINT)

- **CNJ Datajud público não expõe partes** (LGPD) — usamos DJEN/Comunica que indexa intimações + partes.
- **CNPJa pública (`open.cnpja.com`) não suporta busca por CPF** — usamos `bff.cnpja.com` (não oficial) para mapeamento CPF→empresas.
- **Match estrito por nome** no Block2: variações ("Sidnei P. de Jesus" vs "Sidnei Piva de Jesus") podem reduzir cobertura. Match flexível foi avaliado e descartado por gerar falsos positivos.
- **Junta Comercial** (alterações contratuais, ex-sócios) não está integrada. Sócios antigos não aparecem.
- **APIs pagas** (Escavador, JusBrasil) não usadas. Sistema 100% sobre fontes públicas gratuitas.

## Documentos relacionados

- [PRODUCT.md](PRODUCT.md) — usuários, voz, princípios estratégicos da IVY
- [DESIGN.md](DESIGN.md) — sistema visual (paleta OKLCH, tipografia, anti-references)
