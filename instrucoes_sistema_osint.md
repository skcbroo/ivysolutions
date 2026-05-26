# INSTRUÇÕES DE MONTAGEM — SISTEMA OSINT PATRIMONIAL (WEB)
## Aplicação completa: Frontend · Backend · Banco de Dados

**Versão:** 2.0 | **Data:** 25/05/2026  
**Stack:** React + Node.js/Express + PostgreSQL  
**Requisitos:** Node.js ≥ 18, PostgreSQL ≥ 14  
**Acesso:** Restrito a usuários internos (analistas) — **não expor a clientes**

---

## PÚBLICO-ALVO E ACESSO

> **Este sistema é de uso exclusivo de analistas internos.**  
> Não deve ser acessível a clientes finais. O acesso deve ser restrito por rede (VPN ou IP allowlist) e/ou autenticação interna, garantindo que apenas a equipe de análise opere a ferramenta.

---

## VISÃO GERAL DO SISTEMA

```
[Frontend React]
  └── Formulário → nome + CPF
  └── Lista de investigações (status em tempo real)
  └── Visualizador de relatório preenchido
        │
        │ HTTP/REST
        ▼
[Backend Node.js/Express]
  └── POST /api/investigacoes     → cria investigação, dispara worker
  └── GET  /api/investigacoes     → lista todas
  └── GET  /api/investigacoes/:id → retorna dados completos + relatório
  └── GET  /api/investigacoes/:id/status → polling de progresso
        │
        │ Worker assíncrono (mesmo processo)
        ▼
[APIs Externas]
  CNPJA → Brasil API → cnpj.biz → PJe (com rate limit 4s)
        │
        ▼
[PostgreSQL]
  investigacoes → empresas → processos → relatorios
```

---

## POR QUE BANCO DE DADOS?

| Motivo | Explicação |
|--------|-----------|
| Investigações demoram | Cada run leva 5–30 min (rate limit PJe). O banco persiste o progresso. |
| Histórico | Comparar investigações do mesmo alvo em datas diferentes. |
| Retomada | Se o servidor cair no meio, os dados já coletados ficam salvos. |
| Multi-usuário | Vários usuários podem consultar resultados sem re-rodar buscas. |

---

## ESTRUTURA DE ARQUIVOS

```
osint-web/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── NovaInvestigacao.tsx   ← formulário nome + CPF
│   │   │   ├── ListaInvestigacoes.tsx ← dashboard de investigações
│   │   │   └── Relatorio.tsx          ← visualizador de resultado
│   │   ├── components/
│   │   │   ├── StatusBadge.tsx        ← badge: pendente/rodando/concluído/erro
│   │   │   └── TabelaEmpresas.tsx     ← tabela de empresas com alertas
│   │   ├── lib/
│   │   │   └── api.ts                 ← funções fetch para o backend
│   │   └── App.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── server.ts                  ← Express + rotas
│   │   ├── config.ts                  ← variáveis de ambiente
│   │   ├── db.ts                      ← Pool PostgreSQL + migrations
│   │   ├── worker.ts                  ← orquestra blocos em background
│   │   ├── routes/
│   │   │   └── investigacoes.ts       ← CRUD + disparo do worker
│   │   ├── apis/                      ← mesmos arquivos do CLI
│   │   │   ├── cnpja.ts
│   │   │   ├── brasilapi.ts
│   │   │   ├── cnpjbiz.ts
│   │   │   └── pje.ts
│   │   ├── blocks/
│   │   │   ├── block1.ts              ← Empresas
│   │   │   └── block2.ts              ← Processos
│   │   └── report/
│   │       └── generator.ts           ← gera markdown do relatório
│   ├── migrations/
│   │   ├── 001_investigacoes.sql
│   │   ├── 002_empresas.sql
│   │   ├── 003_processos.sql
│   │   └── 004_relatorios.sql
│   └── package.json
```

---

## BANCO DE DADOS — SCHEMA COMPLETO

### Migration 001 — Tabela principal
```sql
-- 001_investigacoes.sql
CREATE TABLE investigacoes (
  id           BIGSERIAL    PRIMARY KEY,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  nome         TEXT         NOT NULL,
  cpf          TEXT         NOT NULL,
  status       TEXT         NOT NULL DEFAULT 'pendente',
  -- pendente | rodando | concluido | erro
  progresso    JSONB        NOT NULL DEFAULT '{}',
  -- { bloco_atual: "block1", total: 20, atual: 7 }
  uuid_cnpja   TEXT,
  cpf_mascarado TEXT,
  capital_total NUMERIC(18,2),
  pje_count    INTEGER,
  erro_msg     TEXT
);

CREATE INDEX inv_status_idx    ON investigacoes (status);
CREATE INDEX inv_cpf_idx       ON investigacoes (cpf);
CREATE INDEX inv_created_idx   ON investigacoes (created_at DESC);
```

### Migration 002 — Empresas encontradas
```sql
-- 002_empresas.sql
CREATE TABLE empresas (
  id               BIGSERIAL    PRIMARY KEY,
  investigacao_id  BIGINT       NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
  cnpj14           TEXT         NOT NULL,
  nome             TEXT,
  nome_fantasia    TEXT,
  situacao         TEXT,
  data_situacao    DATE,
  abertura         DATE,
  capital          NUMERIC(18,2),
  cnae             TEXT,
  natureza         TEXT,
  porte            TEXT,
  cargo            TEXT,
  data_entrada     DATE,
  endereco         TEXT,
  email            TEXT,
  telefone         TEXT,
  qsa              JSONB        NOT NULL DEFAULT '[]',
  -- [{ nome_socio, qualificacao_socio, data_entrada_sociedade, faixa_etaria }]
  alertas          JSONB        NOT NULL DEFAULT '[]'
  -- ["email pessoal em empresa de alto capital", ...]
);

CREATE INDEX emp_inv_idx  ON empresas (investigacao_id);
CREATE INDEX emp_cnpj_idx ON empresas (cnpj14);
```

### Migration 003 — Processos judiciais
```sql
-- 003_processos.sql
CREATE TABLE processos (
  id               BIGSERIAL   PRIMARY KEY,
  investigacao_id  BIGINT      NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
  numero           TEXT        NOT NULL,
  tribunal         TEXT,
  orgao            TEXT,
  classe           TEXT,
  tipo             TEXT,
  polo             TEXT,   -- 'A' = autor, 'P' = réu
  link             TEXT,
  criminal         BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE processos_empresas_vinculadas (
  investigacao_id  BIGINT  NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
  nome             TEXT    NOT NULL,
  polo             TEXT
);

CREATE TABLE processos_advogados (
  investigacao_id  BIGINT  NOT NULL REFERENCES investigacoes(id) ON DELETE CASCADE,
  nome             TEXT    NOT NULL,
  oab              TEXT
);

CREATE INDEX proc_inv_idx ON processos (investigacao_id);
```

### Migration 004 — Relatório gerado
```sql
-- 004_relatorios.sql
CREATE TABLE relatorios (
  id               BIGSERIAL    PRIMARY KEY,
  investigacao_id  BIGINT       NOT NULL UNIQUE REFERENCES investigacoes(id) ON DELETE CASCADE,
  gerado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  conteudo_md      TEXT         NOT NULL   -- markdown completo
);
```

---

## BACKEND — ROTAS DA API

### `POST /api/investigacoes`
Cria uma nova investigação e dispara o worker em background.

**Body:**
```json
{ "nome": "Fulano de Tal", "cpf": "000.000.000-00" }
```

**Response 201:**
```json
{
  "id": 42,
  "status": "pendente",
  "nome": "Fulano de Tal",
  "cpf": "000.000.000-00",
  "created_at": "2026-05-25T..."
}
```

**Lógica:**
```typescript
// routes/investigacoes.ts
router.post('/', async (req, res) => {
  const { nome, cpf } = req.body;
  if (!nome || !cpf) return res.status(400).json({ error: 'nome e cpf obrigatórios' });

  const { rows } = await pool.query(
    `INSERT INTO investigacoes (nome, cpf) VALUES ($1, $2) RETURNING *`,
    [nome.trim(), cpf.replace(/\D/g, '')]
  );
  const inv = rows[0];

  // Dispara worker sem aguardar (não bloqueia a resposta)
  runWorker(inv.id).catch(err =>
    pool.query(`UPDATE investigacoes SET status='erro', erro_msg=$1 WHERE id=$2`, [err.message, inv.id])
  );

  res.status(201).json(inv);
});
```

---

### `GET /api/investigacoes`
Lista todas as investigações.

**Response 200:**
```json
[
  { "id": 42, "nome": "Fulano", "cpf": "***", "status": "concluido", "created_at": "..." },
  { "id": 41, "nome": "Ciclano", "cpf": "***", "status": "rodando", "progresso": { "bloco_atual": "block2", "atual": 3, "total": 15 } }
]
```

---

### `GET /api/investigacoes/:id/status`
Polling de progresso (frontend chama a cada 3s enquanto status = "rodando").

**Response 200:**
```json
{
  "status": "rodando",
  "progresso": { "bloco_atual": "block1", "atual": 5, "total": 12 },
  "capital_total": null,
  "pje_count": null
}
```

---

### `GET /api/investigacoes/:id`
Retorna investigação completa com empresas, processos e relatório.

**Response 200:**
```json
{
  "id": 42,
  "nome": "Fulano de Tal",
  "status": "concluido",
  "capital_total": 15000000,
  "pje_count": 342,
  "empresas": [ { "cnpj14": "...", "nome": "...", "situacao": "ATIVA", "email": "...", ... } ],
  "processos": [ { "numero": "...", "tribunal": "TJSP", "polo": "P", "criminal": true } ],
  "advogados": [ { "nome": "...", "oab": "..." } ],
  "relatorio_md": "# RELATÓRIO INVESTIGATIVO..."
}
```

---

## BACKEND — WORKER ASSÍNCRONO

O worker é a peça central: roda os blocos, salva cada resultado no banco e atualiza o progresso.

```typescript
// worker.ts
export async function runWorker(investigacaoId: number) {
  const setStatus = (status: string, extra = {}) =>
    pool.query(
      `UPDATE investigacoes SET status=$1, updated_at=now(), ${
        Object.keys(extra).map((k,i) => `${k}=$${i+2}`).join(',') || 'updated_at=now()'
      } WHERE id=$${Object.keys(extra).length + 2}`,
      [status, ...Object.values(extra), investigacaoId]
    );

  const setProgresso = (progresso: object) =>
    pool.query(
      `UPDATE investigacoes SET progresso=$1, updated_at=now() WHERE id=$2`,
      [JSON.stringify(progresso), investigacaoId]
    );

  const { rows } = await pool.query(`SELECT * FROM investigacoes WHERE id=$1`, [investigacaoId]);
  const inv = rows[0];

  await setStatus('rodando');

  // ── BLOCO 1: Empresas ──────────────────────────────────────
  await setProgresso({ bloco_atual: 'block1', atual: 0, total: 0 });
  const b1 = await runBlock1(inv.nome, inv.cpf, async (atual, total) => {
    await setProgresso({ bloco_atual: 'block1', atual, total });
  });

  // Salva empresas no banco
  for (const e of b1.empresas) {
    await pool.query(
      `INSERT INTO empresas (investigacao_id, cnpj14, nome, nome_fantasia, situacao,
        data_situacao, abertura, capital, cnae, natureza, porte, cargo,
        data_entrada, endereco, email, telefone, qsa, alertas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [investigacaoId, e.cnpj14, e.nome, e.nomeFantasia, e.situacao,
       e.dataSituacao, e.abertura, e.capital, e.cnae, e.natureza, e.porte, e.cargo,
       e.dataEntrada, e.endereco, e.email, e.telefone,
       JSON.stringify(e.qsa), JSON.stringify(e.alertas || [])]
    );
  }

  await pool.query(
    `UPDATE investigacoes SET uuid_cnpja=$1, cpf_mascarado=$2, capital_total=$3 WHERE id=$4`,
    [b1.uuid, b1.cpfMasked, b1.totalCapital, investigacaoId]
  );

  // ── BLOCO 2: Processos ─────────────────────────────────────
  await setProgresso({ bloco_atual: 'block2', atual: 0, total: 0 });
  const b2 = await runBlock2(inv.nome, async (atual, total) => {
    await setProgresso({ bloco_atual: 'block2', atual, total });
  });

  // Salva processos
  for (const p of b2.processos) {
    const isCriminal = /PENAL|CRIMINAL|RHC|HC|IPL|AP\b/i.test((p.classe || '') + (p.orgao || ''));
    await pool.query(
      `INSERT INTO processos (investigacao_id, numero, tribunal, orgao, classe, tipo, polo, link, criminal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [investigacaoId, p.numero, p.tribunal, p.orgao, p.classe, p.tipo, p.polo, p.link, isCriminal]
    );
  }

  for (const e of b2.empresasVinculadas)
    await pool.query(
      `INSERT INTO processos_empresas_vinculadas (investigacao_id, nome, polo) VALUES ($1,$2,$3)`,
      [investigacaoId, e.nome, e.polo]
    );

  for (const a of b2.advogados)
    await pool.query(
      `INSERT INTO processos_advogados (investigacao_id, nome, oab) VALUES ($1,$2,$3)`,
      [investigacaoId, a.nome, a.oab]
    );

  await pool.query(
    `UPDATE investigacoes SET pje_count=$1 WHERE id=$2`,
    [b2.count, investigacaoId]
  );

  // ── RELATÓRIO ──────────────────────────────────────────────
  const relatorioMd = generateReport(inv.nome, inv.cpf, b1, b2);
  await pool.query(
    `INSERT INTO relatorios (investigacao_id, conteudo_md) VALUES ($1, $2)`,
    [investigacaoId, relatorioMd]
  );

  await setStatus('concluido');
}
```

---

## FRONTEND — PÁGINAS

### Página 1 — `NovaInvestigacao.tsx`
Formulário simples com dois campos e botão.

```
┌─────────────────────────────────────────┐
│  NOVA INVESTIGAÇÃO OSINT                │
│                                         │
│  Nome completo                          │
│  ┌─────────────────────────────────┐   │
│  │ Sidnei Piva de Jesus            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  CPF                                    │
│  ┌─────────────────────────────────┐   │
│  │ 062.567.398-09                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [ Iniciar Investigação ]               │
└─────────────────────────────────────────┘
```

**Lógica:**
- POST `/api/investigacoes` com nome + CPF
- Redireciona para `/investigacoes/:id` (página de resultado)

---

### Página 2 — `ListaInvestigacoes.tsx`
Dashboard com todas as investigações e status em tempo real.

```
┌──────────────────────────────────────────────────────────┐
│  INVESTIGAÇÕES                          [ + Nova ]       │
├──────────┬──────────────────┬───────────┬────────────────┤
│ Data     │ Nome             │ Status    │ Resultado       │
├──────────┼──────────────────┼───────────┼────────────────┤
│ 25/05/26 │ Sidnei Piva...   │ ● Concluído│ 43 emp · 342 proc│
│ 25/05/26 │ Douglas Azara    │ ⟳ Rodando  │ Block 1 (7/14)  │
│ 24/05/26 │ Fulano de Tal    │ ✗ Erro     │ Ver detalhes    │
└──────────┴──────────────────┴───────────┴────────────────┘
```

**Status badge:**
- `pendente` → cinza
- `rodando` → azul piscando + progresso
- `concluido` → verde
- `erro` → vermelho

---

### Página 3 — `Relatorio.tsx`
Exibe os dados da investigação em abas.

```
┌──────────────────────────────────────────────────────────┐
│  Sidnei Piva de Jesus — CPF: 062.***.***.09             │
│  Concluído em 25/05/2026 às 14:32                       │
│                                                          │
│  [ Empresas (43) ] [ Processos (127) ] [ Relatório MD ] │
├──────────────────────────────────────────────────────────┤
│  ABA EMPRESAS:                                           │
│  ┌───┬────────────────┬──────────┬───────────┬────────┐ │
│  │ # │ Empresa        │ Situação │ Capital   │ Email  │ │
│  ├───┼────────────────┼──────────┼───────────┼────────┤ │
│  │ 1 │ SPJ Piva...    │ ● ATIVA  │ R$ 50.000 │ spj... │ │
│  │ 2 │ Itapemirim ... │ ✗ FALIDA │ R$ 10M    │ nfe... │ │
│  └───┴────────────────┴──────────┴───────────┴────────┘ │
│                                                          │
│  ⚠ ALERTAS: Email compartilhado em 3 empresas           │
│                                                          │
│  [ Exportar .md ] [ Copiar relatório ]                  │
└──────────────────────────────────────────────────────────┘
```

---

## FRONTEND — `src/lib/api.ts`

```typescript
const BASE = '/api';

export const api = {
  novaInvestigacao: (nome: string, cpf: string) =>
    fetch(`${BASE}/investigacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, cpf })
    }).then(r => r.json()),

  listar: () =>
    fetch(`${BASE}/investigacoes`).then(r => r.json()),

  buscar: (id: number) =>
    fetch(`${BASE}/investigacoes/${id}`).then(r => r.json()),

  status: (id: number) =>
    fetch(`${BASE}/investigacoes/${id}/status`).then(r => r.json()),
};
```

---

## POLLING DE PROGRESSO NO FRONTEND

Enquanto status = "rodando", o frontend consulta `/status` a cada 3 segundos:

```typescript
// Relatorio.tsx
useEffect(() => {
  if (inv?.status !== 'rodando') return;

  const interval = setInterval(async () => {
    const s = await api.status(id);
    setProgresso(s.progresso);
    if (s.status !== 'rodando') {
      clearInterval(interval);
      // Recarrega dados completos
      const full = await api.buscar(id);
      setInvestigacao(full);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [inv?.status]);
```

---

## VARIÁVEIS DE AMBIENTE

```env
# backend/.env.example

NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/osint_db
CORS_ORIGIN=http://localhost:5173
```

---

## FLUXO COMPLETO — PASSO A PASSO

```
1. Usuário preenche nome + CPF no frontend
        │
        ▼
2. Frontend POST /api/investigacoes
   Backend insere na tabela investigacoes (status: 'pendente')
   Backend retorna { id: 42 }
        │
        ▼
3. Backend dispara runWorker(42) em background (não bloqueia)
   Frontend redireciona para /investigacoes/42
        │
        ▼
4. Worker atualiza status para 'rodando'
   Block 1: para cada empresa → brasilapi + cnpjbiz → INSERT em empresas
   Block 2: para cada página PJe → INSERT em processos (4s de delay por req)
   Gera relatório markdown → INSERT em relatorios
   Atualiza status para 'concluido'
        │
        ▼
5. Frontend polling /status a cada 3s
   Quando status = 'concluido':
     → GET /investigacoes/42 com dados completos
     → Renderiza abas: Empresas | Processos | Relatório MD
```

---

## ESTIMATIVA DE TEMPO POR INVESTIGAÇÃO

| Etapa | Tempo estimado |
|-------|---------------|
| Block 1 — 10 empresas | ~2 min (Brasil API + cnpj.biz por empresa) |
| Block 1 — 40 empresas | ~8 min |
| Block 2 — 5 páginas PJe | ~20s (4s × 5) |
| Block 2 — 20 páginas PJe | ~80s |
| Geração do relatório | < 1s |
| **Total investigação simples** | **~3–5 min** |
| **Total investigação complexa** | **~15–30 min** |

> Por isso o modelo assíncrono é essencial — o usuário não pode ficar aguardando uma requisição HTTP de 30 minutos.

---

## ITENS MANUAIS (sem automação possível)

| Item | Motivo | Link |
|------|--------|------|
| ARISP (imóveis SP) | Exige login | https://www.arisp.com.br/ |
| ICIJ Offshore Leaks | Sem API JSON | https://offshoreleaks.icij.org/ |
| Florida Sunbiz | Sem API JSON | https://search.sunbiz.org/ |
| Miami-Dade ORS | Session cookie | https://www.miami-dadeclerk.com/ocs/ |
| RENAJUD | Acesso restrito | Via PJe ou judicial |

O relatório gerado inclui os links diretos com o nome pré-preenchido na URL para agilizar as buscas manuais.

---

## EXTENSÕES FUTURAS

| Feature | Como implementar |
|---------|-----------------|
| Re-rodar investigação | Novo endpoint `POST /api/investigacoes/:id/rerun` |
| Comparar duas datas | Diff entre investigacoes do mesmo CPF |
| Exportar PDF | `pandoc relatorio.md -o relatorio.pdf` via endpoint |
| Autenticação | JWT simples ou sessão — **obrigatório** para uso em produção (acesso interno apenas) |
| Companies House UK | Adicionar `apis/companieshouse.ts` + bloco na migration |
| Notificação por email | Enviar email quando investigação concluir |
| Busca por co-sócios | Botão "Investigar este sócio" dentro da aba QSA |

---

*Sistema OSINT Patrimonial v2.0 — 25/05/2026*  
*Stack: React + Node.js/Express + PostgreSQL*
